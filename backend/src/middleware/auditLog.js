const { pool } = require('../config/database');

// Middleware to automatically log all mutations
const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send function to capture response
    res.send = function (data) {
      // Only log successful mutations (status 200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const logData = {
          userId: req.user?.id,
          action,
          entityType,
          entityId: req.params.id || null,
          changes: {
            body: req.body,
            params: req.params,
            query: req.query,
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          status: 'success',
        };

        // Log asynchronously (don't block response)
        pool.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            logData.userId,
            logData.action,
            logData.entityType,
            logData.entityId,
            JSON.stringify(logData.changes),
            logData.ipAddress,
            logData.userAgent,
            logData.status,
          ]
        ).catch(err => console.error('Audit log error:', err));
      }

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = auditLog;
