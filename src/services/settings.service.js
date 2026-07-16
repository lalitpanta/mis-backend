class SettingsService {
  getPool(req) {
    return req?.tenantPool || require("../config/db");
  }

  async getSchoolProfileFallback(req) {
    const pool = this.getPool(req);
    const fallback = await pool.query(
      'SELECT value FROM "settings" WHERE key = $1 LIMIT 1',
      ["school_profile"],
    );
    const raw = fallback.rows[0]?.value || null;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async getSchoolProfile(req) {
    const pool = this.getPool(req);

    try {
      const profileResult = await pool.query(
        "SELECT * FROM school_profile LIMIT 1",
      );
      const row = profileResult.rows[0];
      if (!row) {
        return this.getSchoolProfileFallback(req);
      }

      const blocksResult = await pool.query(
        `SELECT b.id AS block_id, b.block_name, f.floor_number
         FROM school_blocks b
         LEFT JOIN school_floors f ON f.block_id = b.id
         WHERE b.profile_id = $1
         ORDER BY b.id, f.floor_number`,
        [row.id],
      );

      const blocksMap = new Map();
      blocksResult.rows.forEach((blockRow) => {
        if (!blocksMap.has(blockRow.block_id)) {
          blocksMap.set(blockRow.block_id, {
            id: blockRow.block_id,
            block_name: blockRow.block_name,
            floors: [],
          });
        }
        const block = blocksMap.get(blockRow.block_id);
        if (Number.isInteger(blockRow.floor_number)) {
          block.floors.push(blockRow.floor_number);
        }
      });

      const blocks = Array.from(blocksMap.values()).map((block) => ({
        ...block,
        floor_count: block.floors.length,
      }));

      const computedFloors = blocks.reduce(
        (sum, block) => sum + block.floor_count,
        0,
      );
      return {
        name: row.name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        website: row.website,
        motto: row.motto,
        logo: row.logo,
        established: row.established,
        country: row.country,
        is_active: row.is_active,
        total_floors:
          row.total_floors !== null ? row.total_floors : computedFloors,
        blocks,
      };
    } catch (err) {
      if (err.message.includes('relation "school_profile" does not exist')) {
        return this.getSchoolProfileFallback(req);
      }
      throw new Error(`Failed to fetch school profile: ${err.message}`);
    }
  }

  async upsertSchoolProfile(profile, req) {
    const pool = this.getPool(req);
    const payload =
      typeof profile === "string" ? JSON.parse(profile) : profile || {};

    const normalizedProfile = {
      name: payload.name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      address: payload.address || null,
      website: payload.website || null,
      motto: payload.motto || null,
      logo: payload.logo || null,
      established: payload.established || null,
      country: payload.country || null,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
    };

    const blocks = Array.isArray(payload.blocks)
      ? payload.blocks
          .map((block) => ({
            block_name: block.block_name || block.name || "",
            floor_count: Math.max(
              1,
              parseInt(block.floor_count ?? block.floors?.length ?? 1, 10) || 1,
            ),
          }))
          .filter((block) => block.block_name.trim().length > 0)
      : null;

    if (Array.isArray(payload.blocks) && blocks.length > 0) {
      normalizedProfile.total_floors = blocks.reduce(
        (sum, block) => sum + block.floor_count,
        0,
      );
    } else if (Array.isArray(payload.blocks) && blocks.length === 0) {
      normalizedProfile.total_floors = 0;
    } else {
      normalizedProfile.total_floors =
        payload.total_floors !== undefined && payload.total_floors !== null
          ? Math.max(0, parseInt(payload.total_floors, 10) || 0)
          : null;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingProfile = await client.query(
        "SELECT id FROM school_profile LIMIT 1",
      );
      let profileId;
      if (existingProfile.rows.length > 0) {
        profileId = existingProfile.rows[0].id;
        await client.query(
          `UPDATE school_profile SET
             name = $1,
             email = $2,
             phone = $3,
             address = $4,
             website = $5,
             motto = $6,
             logo = $7,
             established = $8,
             country = $9,
             total_floors = $10,
             is_active = $11,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $12`,
          [
            normalizedProfile.name,
            normalizedProfile.email,
            normalizedProfile.phone,
            normalizedProfile.address,
            normalizedProfile.website,
            normalizedProfile.motto,
            normalizedProfile.logo,
            normalizedProfile.established,
            normalizedProfile.country,
            normalizedProfile.total_floors,
            normalizedProfile.is_active,
            profileId,
          ],
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO school_profile
             (name, email, phone, address, website, motto, logo, established, country, total_floors, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            normalizedProfile.name,
            normalizedProfile.email,
            normalizedProfile.phone,
            normalizedProfile.address,
            normalizedProfile.website,
            normalizedProfile.motto,
            normalizedProfile.logo,
            normalizedProfile.established,
            normalizedProfile.country,
            normalizedProfile.total_floors,
            normalizedProfile.is_active,
          ],
        );
        profileId = inserted.rows[0].id;
      }

      if (Array.isArray(payload.blocks)) {
        await client.query(
          "DELETE FROM school_floors WHERE block_id IN (SELECT id FROM school_blocks WHERE profile_id = $1)",
          [profileId],
        );
        await client.query("DELETE FROM school_blocks WHERE profile_id = $1", [
          profileId,
        ]);

        if (blocks && blocks.length > 0) {
          for (const block of blocks) {
            const blockInsert = await client.query(
              `INSERT INTO school_blocks (profile_id, block_name, created_at, updated_at)
               VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               RETURNING id`,
              [profileId, block.block_name.trim()],
            );
            const blockId = blockInsert.rows[0].id;

            for (
              let floorNumber = 1;
              floorNumber <= block.floor_count;
              floorNumber += 1
            ) {
              await client.query(
                `INSERT INTO school_floors (block_id, floor_number, created_at, updated_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [blockId, floorNumber],
              );
            }
          }
        }
      }

      await client.query('DELETE FROM "settings" WHERE key = $1', [
        "school_profile",
      ]);
      await client.query("COMMIT");

      return this.getSchoolProfile(req);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to save school profile: ${err.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get all settings
   */
  getAllSettings = async (req) => {
    try {
      const pool = this.getPool(req);
      const query = 'SELECT key, value FROM "settings"';
      await pool.query('DELETE FROM "settings" WHERE key = $1', [
        "classroom_layout",
      ]);
      const result = await pool.query(query);
      const settings = result.rows.reduce((acc, row) => {
        if (row.key === "classroom_layout" || row.key === "school_profile") {
          return acc;
        }
        try {
          acc[row.key] = JSON.parse(row.value);
        } catch (e) {
          acc[row.key] = row.value;
        }
        return acc;
      }, {});

      const schoolProfile = await this.getSchoolProfile(req);
      if (schoolProfile) settings.school_profile = schoolProfile;
      return settings;
    } catch (err) {
      throw new Error(`Failed to fetch settings: ${err.message}`);
    }
  };

  /**
   * Get a specific setting by key
   */
  getSettingByKey = async (key, req) => {
    try {
      if (key === "classroom_layout") return null;
      if (key === "school_profile") return await this.getSchoolProfile(req);

      const pool = this.getPool(req);
      const query = 'SELECT value FROM "settings" WHERE key = $1';
      const result = await pool.query(query, [key]);
      const raw = result.rows[0]?.value || null;
      if (raw === null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch (err) {
      throw new Error(`Failed to fetch setting ${key}: ${err.message}`);
    }
  };

  /**
   * Update or create a setting
   */
  updateSetting = async (key, value, req) => {
    try {
      if (key === "school_profile") {
        const profile = typeof value === "string" ? JSON.parse(value) : value;
        const result = await this.upsertSchoolProfile(profile, req);
        return { key: "school_profile", value: JSON.stringify(result) };
      }

      const pool = this.getPool(req);
      const query = `
        INSERT INTO "settings" (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const result = await pool.query(query, [key, value]);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to update setting ${key}: ${err.message}`);
    }
  };

  /**
   * Delete a setting by key
   */
  deleteSetting = async (key, req) => {
    try {
      const pool = this.getPool(req);
      if (key === "school_profile") {
        await pool.query(
          "DELETE FROM school_floors WHERE block_id IN (SELECT id FROM school_blocks WHERE profile_id IN (SELECT id FROM school_profile))",
        );
        await pool.query(
          "DELETE FROM school_blocks WHERE profile_id IN (SELECT id FROM school_profile)",
        );
        await pool.query("DELETE FROM school_profile");
        return true;
      }
      await pool.query('DELETE FROM "settings" WHERE key = $1', [key]);
      return true;
    } catch (err) {
      throw new Error(`Failed to delete setting ${key}: ${err.message}`);
    }
  };
}

const settingsService = new SettingsService();
module.exports = settingsService;
