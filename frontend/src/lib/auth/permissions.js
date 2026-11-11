import {
  PERMISSIONS,
  ALIAS_MAP,
  SECTION5_CATALOG,
  CANONICAL_PERMISSIONS,
  SECTION5_PERMISSIONS,
  resolvePermissionAliases,
} from "../../constants/permissions.js";

/**
 * Check whether an effective permission set satisfies all required permissions,
 * supporting single string, string arrays, wildcard '*', and wildcard prefix matching (e.g. 'products.*').
 *
 * @param {string[]|Set<string>} userPermissions
 * @param {string|string[]} requiredPermissions
 * @returns {boolean}
 */
export const checkPermissionsMatch = (userPermissions, requiredPermissions) => {
  if (!userPermissions) return false;
  const permSet =
    userPermissions instanceof Set
      ? userPermissions
      : new Set(Array.isArray(userPermissions) ? userPermissions : []);

  const reqArray = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : typeof requiredPermissions === "string" && requiredPermissions.trim()
    ? [requiredPermissions.trim()]
    : [];

  if (reqArray.length === 0) {
    return true;
  }

  // If user has wildcard '*', all permissions are satisfied
  if (permSet.has("*")) return true;

  return reqArray.every((reqPerm) => {
    // 1. Direct exact match
    if (permSet.has(reqPerm)) return true;

    // 2. Wildcard prefix match from granted permissions (e.g. 'products.*')
    for (const granted of permSet) {
      if (typeof granted === "string" && granted.endsWith(".*")) {
        const prefix = granted.slice(0, -2);
        if (reqPerm === prefix || reqPerm.startsWith(`${prefix}.`)) {
          return true;
        }
      }
    }

    // 3. Bidirectional alias resolution
    const aliases = resolvePermissionAliases(reqPerm);
    return aliases.some((alias) => permSet.has(alias));
  });
};

/**
 * Helper to extract permission array from user object or permission array/Set.
 *
 * @param {Object|Array|Set} userOrPermissions
 * @returns {string[]}
 */
export const extractPermissions = (userOrPermissions) => {
  if (!userOrPermissions) return [];
  if (Array.isArray(userOrPermissions)) return userOrPermissions;
  if (userOrPermissions instanceof Set) return Array.from(userOrPermissions);
  if (typeof userOrPermissions === "object") {
    // Check if superadmin
    const role = (userOrPermissions.role || "").toLowerCase().replace(/[-_]/g, "");
    if (role === "superadmin") return ["*"];

    return (
      userOrPermissions.permissions ||
      userOrPermissions.effectivePermissions ||
      userOrPermissions.employee?.jobRole?.permissions ||
      userOrPermissions.jobRole?.permissions ||
      []
    );
  }
  return [];
};

/**
 * Check if a user possesses a specific permission (with alias resolution).
 *
 * @param {Object|Array} userOrPermissions
 * @param {string} permission
 * @returns {boolean}
 */
export const hasPermission = (userOrPermissions, permission) => {
  if (!permission) return false;
  const perms = extractPermissions(userOrPermissions);
  return checkPermissionsMatch(perms, [permission]);
};

/**
 * Check if a user possesses at least one of the specified permissions.
 *
 * @param {Object|Array} userOrPermissions
 * @param {string[]} permissions
 * @returns {boolean}
 */
export const hasAnyPermission = (userOrPermissions, permissions = []) => {
  if (!Array.isArray(permissions) || permissions.length === 0) return false;
  const perms = extractPermissions(userOrPermissions);
  const permSet = new Set(perms);
  if (permSet.has("*")) return true;

  return permissions.some((reqPerm) => {
    return checkPermissionsMatch(permSet, reqPerm);
  });
};

/**
 * Check if a user possesses all of the specified permissions.
 *
 * @param {Object|Array} userOrPermissions
 * @param {string[]} permissions
 * @returns {boolean}
 */
export const hasAllPermissions = (userOrPermissions, permissions = []) => {
  if (!Array.isArray(permissions) || permissions.length === 0) return true;
  const perms = extractPermissions(userOrPermissions);
  return checkPermissionsMatch(perms, permissions);
};

export {
  PERMISSIONS,
  ALIAS_MAP,
  SECTION5_CATALOG,
  CANONICAL_PERMISSIONS,
  SECTION5_PERMISSIONS,
  resolvePermissionAliases,
};
