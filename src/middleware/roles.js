const ROLE_LEVELS = { viewer: 1, analyst: 2, admin: 3 };

/**
 * Allows only users whose role matches one of the provided roles exactly.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `Access denied. Required role(s): ${roles.join(', ')}` });
    }
    next();
  };
}

/**
 * Allows users whose role is at or above the given minimum level.
 * Order: viewer < analyst < admin
 */
function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    const minLevel = ROLE_LEVELS[minRole] || 0;
    if (userLevel < minLevel) {
      return res
        .status(403)
        .json({ error: `Access denied. Minimum required role: ${minRole}` });
    }
    next();
  };
}

module.exports = { requireRole, requireMinRole };
