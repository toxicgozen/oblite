export function validateProfile(value) {
  if (!value || typeof value !== 'object') throw new Error('缺少观察方案。');
  const text = (input, name, max) => {
    if (typeof input !== 'string' || !input.trim() || input.length > max) throw new Error(name + '不能为空，且长度不能超过 ' + max + '。');
    return input.trim();
  };
  const id = text(value.id, '方案 ID', 64);
  const name = text(value.name, '方案名称', 80);
  const subject = text(value.subject, '观察对象', 600);
  if (!Array.isArray(value.points) || value.points.length < 1 || value.points.length > 24) throw new Error('每个方案需要 1–24 个点位。');
  const ids = new Set();
  const points = value.points.map(p => {
    const pointId = text(p?.id, '点位 ID', 64);
    if (!/^[a-zA-Z0-9_-]+$/.test(pointId) || ids.has(pointId)) throw new Error('点位 ID 必须唯一，并只使用英文字母、数字、短横线或下划线。');
    ids.add(pointId);
    return {id:pointId, label:text(p.label, '点位名称', 48), instruction:text(p.instruction, '点位定义', 600)};
  });
  return {id, name, subject, points};
}

export function normalizeDetection(raw, profile) {
  if (!raw || !Array.isArray(raw.points)) throw new Error('检测服务没有返回点位列表，请重试。');
  const allowed = new Set(profile.points.map(p => p.id));
  const byId = new Map();
  for (const item of raw.points) {
    if (!item || !allowed.has(item.id) || byId.has(item.id)) throw new Error('检测结果包含未知或重复点位，请重试。');
    if (!['found','uncertain','not_visible'].includes(item.status)) throw new Error('检测结果中的点位状态无效，请重试。');
    if (typeof item.reason !== 'string' || item.reason.length > 600) throw new Error('检测结果说明无效。');
    const hasPosition = item.x !== null && item.y !== null;
    if ((item.x === null) !== (item.y === null)) throw new Error('检测结果中的坐标不完整。');
    if (hasPosition && (!Number.isFinite(item.x) || !Number.isFinite(item.y) || item.x < 0 || item.x > 1000 || item.y < 0 || item.y > 1000)) throw new Error('检测结果中的坐标越界，请重试。');
    if (item.status === 'found' && !hasPosition) throw new Error('已定位的点缺少坐标。');
    if (item.status === 'not_visible' && hasPosition) throw new Error('不可见的点不应带有猜测坐标。');
    byId.set(item.id, {...item, x:hasPosition ? item.x / 1000 : null, y:hasPosition ? item.y / 1000 : null});
  }
  return profile.points.map(p => {
    const item = byId.get(p.id);
    return {id:p.id, label:p.label, instruction:p.instruction, status:item?.status ?? 'not_visible', x:item?.x ?? null, y:item?.y ?? null, reason:item?.reason || (item ? '' : '模型未返回此点。')};
  });
}

export function pixelPosition(point, width, height) {
  if (point.x === null || point.y === null) return null;
  return {x:Math.round(point.x * (width - 1)), y:Math.round(point.y * (height - 1))};
}

export function parsePointLines(input) {
  return input.split('\n').map(line => line.trim()).filter(Boolean).map((line, i) => {
    const split = line.indexOf('|');
    const label = (split < 0 ? line : line.slice(0,split)).trim();
    return {id:'point-' + (i+1),label,instruction:(split < 0 ? label : line.slice(split+1)).trim()};
  });
}
