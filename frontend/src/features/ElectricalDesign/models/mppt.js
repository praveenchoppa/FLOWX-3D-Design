/**
 * mppt.js — MPPT (Charge Controller) entity factory (P4).
 */

/**
 * @typedef {object} ElectricalMppt
 * @property {string} id
 * @property {string} displayName
 * @property {string} inverterId
 * @property {string[]} stringIds
 * @property {number|null} capacity
 */

/**
 * @param {object} params
 * @returns {ElectricalMppt}
 */
export function createMppt({
  id,
  displayName,
  inverterId,
  stringIds = [],
  capacity = null,
}) {
  return {
    id,
    displayName,
    inverterId,
    stringIds: [...stringIds],
    capacity,
  };
}

/**
 * Generate MPPTs for an inverter from chargeControllerCount.
 *
 * @param {object} inverter
 * @param {number|null} [mpptCapacityKw]
 */
export function createMpptsForInverter(inverter, mpptCapacityKw = null) {
  const count = inverter.chargeControllerCount ?? 0;
  const mppts = [];

  for (let i = 0; i < count; i += 1) {
    const mpptId = typeof crypto !== "undefined" && crypto.randomUUID
      ? `mppt-${crypto.randomUUID()}`
      : `mppt-${Date.now()}-${i}`;
    mppts.push(createMppt({
      id:          mpptId,
      displayName: `MPPT ${i + 1}`,
      inverterId:  inverter.id,
      stringIds:   [],
      capacity:    mpptCapacityKw,
    }));
  }

  return mppts;
}

/**
 * MPPTs belonging to one inverter, ordered by inverter.mpptIds when present.
 *
 * @param {ElectricalMppt[]} mppts
 * @param {object} inverterOrId
 */
export function mpptsForInverter(mppts, inverterOrId) {
  const inverterId = typeof inverterOrId === "string"
    ? inverterOrId
    : inverterOrId?.id;
  const inInverter = (mppts ?? []).filter((m) => m.inverterId === inverterId);
  const order = typeof inverterOrId === "object" ? inverterOrId?.mpptIds : null;

  if (!order?.length) return inInverter;

  const byId = new Map(inInverter.map((m) => [m.id, m]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const remainder = inInverter.filter((m) => !order.includes(m.id));
  return [...ordered, ...remainder];
}

/**
 * Clear all string references on MPPTs (placement refresh / inverter reselect).
 *
 * @param {ElectricalMppt[]} mppts
 */
export function clearMpptStringReferences(mppts) {
  return (mppts ?? []).map((m) => ({ ...m, stringIds: [] }));
}

/**
 * Remove MPPTs owned by the given inverter ids.
 *
 * @param {ElectricalMppt[]} mppts
 * @param {string[]} inverterIds
 */
export function removeMpptsForInverters(mppts, inverterIds) {
  const remove = new Set(inverterIds ?? []);
  return (mppts ?? []).filter((m) => !remove.has(m.inverterId));
}

/**
 * Resolve the parent inverter for an MPPT.
 *
 * @param {object[]} inverters
 * @param {object|null} mppt
 */
export function inverterForMppt(inverters, mppt) {
  if (!mppt?.inverterId) return null;
  return (inverters ?? []).find((i) => i.id === mppt.inverterId) ?? null;
}
