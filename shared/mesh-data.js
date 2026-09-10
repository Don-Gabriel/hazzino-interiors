export function meshMetrics(o) {
  const scale = o.size.map((v, i) => v / (o.meshSize?.[i] || v));
  let area = 0,
    volume = 0;
  const at = (i) => [0, 1, 2].map((a) => o.vertices[i * 3 + a] * scale[a]);
  for (let i = 0; i < o.triangles.length; i += 3) {
    const a = at(o.triangles[i]),
      b = at(o.triangles[i + 1]),
      c = at(o.triangles[i + 2]);
    const ab = b.map((v, j) => v - a[j]),
      ac = c.map((v, j) => v - a[j]);
    area +=
      Math.hypot(
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ) / 2;
    volume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  return { area: area / 1e6, volume: Math.abs(volume) / 1e9, edge: 0 };
}

export function validateMesh(o) {
  if (o.faceGroups != null) {
    if (!Array.isArray(o.faceGroups) || o.faceGroups.length > 10000)
      throw Error("Invalid mesh face groups");
    let end = 0;
    for (const g of o.faceGroups) {
      if (
        !g ||
        !Number.isInteger(g.start) ||
        !Number.isInteger(g.count) ||
        g.start !== end ||
        g.count <= 0 ||
        g.count % 3 ||
        typeof g.material !== "string"
      )
        throw Error("Invalid mesh face group");
      end += g.count;
    }
    if (end !== o.triangles?.length) throw Error("Incomplete mesh face groups");
  }
  if (
    o.uv != null &&
    (!Array.isArray(o.uv) ||
      o.uv.length !== (o.vertices?.length / 3) * 2 ||
      o.uv.some((v) => !Number.isFinite(v)))
  )
    throw Error("Invalid mesh texture coordinates");
  if (
    !Array.isArray(o.vertices) ||
    o.vertices.length < 9 ||
    o.vertices.length % 3 ||
    o.vertices.length > 1500000 ||
    o.vertices.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e8)
  )
    throw Error("Invalid mesh vertices");
  if (
    !Array.isArray(o.triangles) ||
    o.triangles.length < 3 ||
    o.triangles.length % 3 ||
    o.triangles.length > 3000000 ||
    o.triangles.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= o.vertices.length / 3,
    )
  )
    throw Error("Invalid mesh triangles");
  if (
    !Array.isArray(o.meshSize) ||
    o.meshSize.length !== 3 ||
    o.meshSize.some((v) => !Number.isFinite(v) || v <= 0)
  )
    throw Error("Invalid mesh reference dimensions");
}
