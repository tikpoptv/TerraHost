const db = require('../config/database');

class DatabaseService {
  
  async testConnection() {
    try {
      const result = await db.query('SELECT NOW() as current_time, version() as db_version');
      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHealthInfo() {
    try {
      const queries = [
        'SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'',
        'SELECT pg_database_size(current_database()) as db_size',
        'SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE state = \'active\''
      ];

      const results = await Promise.all(
        queries.map(query => db.query(query))
      );

      return {
        success: true,
        data: {
          table_count: results[0].rows[0].table_count,
          database_size: results[1].rows[0].db_size,
          active_connections: results[2].rows[0].active_connections,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeQuery(queryText, params = []) {
    try {
      const result = await db.query(queryText, params);
      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async create(table, data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
      
      const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await db.query(query, values);
      
      return {
        success: true,
        data: result.rows[0],
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async findAll(table, conditions = {}, options = {}) {
    try {
      let query = `SELECT * FROM ${table}`;
      let params = [];
      let paramIndex = 1;

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions).map(key => {
          params.push(conditions[key]);
          return `${key} = $${paramIndex++}`;
        }).join(' AND ');
        query += ` WHERE ${whereClause}`;
      }

      if (options.orderBy) {
        query += ` ORDER BY ${options.orderBy}`;
        if (options.order) {
          query += ` ${options.order}`;
        }
      }

      if (options.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      if (options.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }

      const result = await db.query(query, params);
      
      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async findById(table, id) {
    try {
      const query = `SELECT * FROM ${table} WHERE id = $1`;
      const result = await db.query(query, [id]);
      
      return {
        success: true,
        data: result.rows[0] || null,
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateById(table, id, data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      
      const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
      const query = `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`;
      
      const result = await db.query(query, [id, ...values]);
      
      return {
        success: true,
        data: result.rows[0] || null,
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteById(table, id) {
    try {
      const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
      const result = await db.query(query, [id]);
      
      return {
        success: true,
        data: result.rows[0] || null,
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new DatabaseService();
