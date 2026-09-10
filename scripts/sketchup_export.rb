# Run inside SketchUp's Ruby Console:
# load 'C:/WorkSpace/Hazzino/scripts/sketchup_export.rb'
# HazzinoExporter.batch('C:/WorkSpace/Hazzino/skpfiles', 'C:/WorkSpace/Hazzino/public/models')
# Source SKP files are read through the official SketchUp Ruby API. A temporary
# operation is aborted after export, restoring the active document's definitions.
require 'json'
require 'securerandom'
require 'base64'
require 'fileutils'
require 'time'

module HazzinoExporter
  def self.id
    SecureRandom.uuid
  end

  def self.material_id(material, project, cache, output)
    return 'plaster' unless material
    return cache[material.entityID] if cache.key?(material.entityID)
    key = id
    color = material.color
    value = { id: key, name: material.display_name.to_s[0, 200], color: format('#%02x%02x%02x', color.red, color.green, color.blue), opacity: material.alpha.to_f, roughness: 0.7, metalness: 0, rate: 0 }
    value[:roughness] = material.roughness_factor.to_f if material.respond_to?(:roughness_factor) && material.roughness_enabled?
    value[:metalness] = material.metallic_factor.to_f if material.respond_to?(:metallic_factor) && material.metalness_enabled?
    if material.texture
      texture_path = File.join(output, "#{key}.png")
      begin
        if material.texture.write(texture_path)
          encoded = 'data:image/png;base64,' + Base64.strict_encode64(File.binread(texture_path))
          if encoded.length <= 8_000_000
            value[:map] = encoded
            value[:textureFlipY] = true
          end
        end
      rescue StandardError => error
        project[:importWarnings] << "Texture #{value[:name]}: #{error.message}"
      ensure
        File.delete(texture_path) if File.exist?(texture_path)
      end
    end
    project[:materials] << value
    cache[material.entityID] = key
  end

  def self.walk(entities, transform, group_id, inherited_material, visible, project, cache, output, path)
    vertices, triangles, uv, face_groups = [], [], [], []
    mirrored = transform.xaxis.cross(transform.yaxis).dot(transform.zaxis) < 0
    buckets = entities.grep(Sketchup::Face).group_by { |face| [face.material || inherited_material, visible && !face.hidden? && face.layer.visible?] }
    buckets.each do |(material, face_visible), faces|
      # Export visible geometry with indexed materials in one mesh per part.
      next unless face_visible
      start = triangles.length
      faces.each do |face|
        mesh = face.mesh(7)
        base = vertices.length / 3
        (1..mesh.count_points).each do |index|
          point = mesh.point_at(index).transform(transform)
          vertices.concat(point.to_a.map { |n| (n.to_f * 25.4).round(6) })
          tex = mesh.uv_at(index, true) || Geom::Point3d.new(0, 0, 1)
          divisor = tex.z.abs < 1.0e-10 ? 1.0 : tex.z
          uv.concat([tex.x / divisor, tex.y / divisor])
        end
        mesh.polygons.each do |polygon|
          polygon = polygon.map { |n| base + n.abs - 1 }
          (1...polygon.length - 1).each do |index|
            tri = [polygon[0], polygon[index], polygon[index + 1]]
            tri.reverse! if mirrored
            triangles.concat(tri)
          end
        end
      end
      count = triangles.length - start
      face_groups << { start: start, count: count, material: material_id(material, project, cache, output) } if count.positive?
    end
    unless triangles.empty?
      points = vertices.each_slice(3).to_a
      min = (0..2).map { |axis| points.map { |point| point[axis] }.min }
      max = (0..2).map { |axis| points.map { |point| point[axis] }.max }
      center = (0..2).map { |axis| (min[axis] + max[axis]) / 2 }
      size = (0..2).map { |axis| [0.1, max[axis] - min[axis]].max }
      vertices = vertices.each_with_index.map { |number, index| (number - center[index % 3]).round(6) }
      project[:objects] << { id: id, kind: 'mesh', name: path.last.to_s, vertices: vertices, triangles: triangles, uv: uv, faceGroups: face_groups, meshSize: size, size: size, position: center, rotation: [0, 0, 0], groupId: group_id, layer: 'Furniture', material: face_groups.first[:material], faceMaterials: {}, visible: visible, locked: false, smooth: false, sourcePath: path }
    end
    entities.each do |item|
      next unless item.is_a?(Sketchup::Group) || item.is_a?(Sketchup::ComponentInstance)
      definition = item.definition
      name = item.name.empty? ? definition.name : item.name
      name = 'Component' if name.empty?
      next_group = id
      project[:groups] << { id: next_group, name: name, parentId: group_id, sourceDefinition: definition.guid }
      walk(definition.entities, transform * item.transformation, next_group, item.material || inherited_material, visible && !item.hidden? && item.layer.visible?, project, cache, output, path + [name])
    end
  end

  def self.batch(input, output)
    FileUtils.mkdir_p(output)
    model = Sketchup.active_model
    records = []
    Dir.glob(File.join(input, '*.skp')).sort.each do |source|
      name = File.basename(source, '.skp').tr('+', ' ')
      puts "Exporting #{name}"
      model.start_operation('Temporary Hazzino export', true)
      begin
        definition = model.definitions.load(source)
        raise 'SketchUp could not read this model' unless definition
        now = Time.now.utc.iso8601
        project = { schemaVersion: 1, id: id, name: name, createdAt: now, updatedAt: now, objects: [], groups: [], layers: [{id: 'Furniture', visible: true}, {id: 'Architecture', visible: true}, {id: 'Annotations', visible: true}], materials: [], views: [], settings: {unit: 'mm', currency: 'INR', grid: 100, snap: 10, waste: 10}, importWarnings: [], sourceFile: File.basename(source) }
        root = id
        project[:groups] << {id: root, name: name}
        walk(definition.entities, Geom::Transformation.new, root, nil, true, project, {}, output, [name])
        project[:groups].select! { |group| project[:objects].any? { |object| object[:groupId] == group[:id] } || project[:groups].any? { |child| child[:parentId] == group[:id] } }
        filename = File.basename(source, '.skp').downcase.gsub(/[^a-z0-9]+/, '-') + '.hazzino.json'
        File.write(File.join(output, filename), JSON.generate(project))
        records << {name: name, file: filename, objects: project[:objects].length, triangles: project[:objects].sum { |object| object[:triangles].length / 3 }, materials: project[:materials].length, warnings: project[:importWarnings]}
        puts "  #{records.last[:objects]} parts; #{records.last[:triangles]} triangles"
      rescue StandardError => error
        records << {name: name, error: error.message}
        puts "  ERROR: #{error.message}"
      ensure
        model.abort_operation
      end
    end
    File.write(File.join(output, 'catalog.json'), JSON.pretty_generate(records))
    puts "Hazzino export finished: #{records.length} models."
    records
  end
end
