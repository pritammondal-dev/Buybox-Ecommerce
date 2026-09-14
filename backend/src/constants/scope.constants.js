const SCOPE_TYPES = Object.freeze({
  VENDOR: "vendor",
  WAREHOUSE: "warehouse",
  CATEGORY: "category",
  SUPPORT_QUEUE: "support_queue",
});

const ALLOWED_SCOPE_TYPES = Object.freeze(Object.values(SCOPE_TYPES));

module.exports = {
  SCOPE_TYPES,
  ALLOWED_SCOPE_TYPES,
};
