module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Create exam_formats table
      await queryInterface.createTable("exam_formats", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        exam_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        class_id: {
          type: Sequelize.INTEGER,
          references: {
            model: "classes",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        section_id: {
          type: Sequelize.INTEGER,
          references: {
            model: "sections",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        academic_year_id: {
          type: Sequelize.INTEGER,
          references: {
            model: "years",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        term: {
          type: Sequelize.STRING(100),
        },
        exam_date: {
          type: Sequelize.DATE,
        },
        pass_mark_percentage: {
          type: Sequelize.NUMERIC(5, 2),
          defaultValue: 40.0,
        },
        created_by: {
          type: Sequelize.UUID,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(\"CURRENT_TIMESTAMP\"),
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(\"CURRENT_TIMESTAMP\"),
        },
      });

      // Create indexes for exam_formats
      await queryInterface.addIndex(\"exam_formats\", [\"class_id\"]);
      await queryInterface.addIndex(\"exam_formats\", [\"section_id\"]);
      await queryInterface.addIndex(\"exam_formats\", [\"academic_year_id\"]);

      // Create exam_subjects table
      await queryInterface.createTable(\"exam_subjects\", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        exam_format_id: {
          type: Sequelize.INTEGER,
          references: {
            model: \"exam_formats\",
            key: \"id\",
          },
          onDelete: \"CASCADE\",
        },
        course_id: {
          type: Sequelize.INTEGER,
          references: {
            model: \"courses\",
            key: \"id\",
          },
          onDelete: \"CASCADE\",
        },
        subject_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        theory_max_marks: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        practical_max_marks: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        total_max_marks: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(\"CURRENT_TIMESTAMP\"),
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(\"CURRENT_TIMESTAMP\"),
        },
      });

      // Create indexes for exam_subjects
      await queryInterface.addIndex(\"exam_subjects\", [\"exam_format_id\"]);

      // Create student_marks table
      await queryInterface.createTable(\"student_marks\", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        exam_format_id: {
          type: Sequelize.INTEGER,
          references: {
            model: \"exam_formats\",
            key: \"id\",
          },
          onDelete: \"CASCADE\",
        },
        exam_subject_id: {
          type: Sequelize.INTEGER,
          references: {
            model: \"exam_subjects\",
            key: \"id\",
          },
          onDelete: \"CASCADE\",
        },
        student_id: {
          type: Sequelize.UUID,
          references: {
            model: \"students\",
            key: \"id\",
          },
          onDelete: \"CASCADE\",
        },
        theory_marks: {
          type: Sequelize.NUMERIC(6, 2),
        },
        practical_marks: {
          type: Sequelize.NUMERIC(6, 2),
        },
        total_marks: {
          type: Sequelize.NUMERIC(6, 2),
        },
        is_pass: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        remarks: {
          type: Sequelize.STRING(500),
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(\"CURRENT_TIMESTAMP\"),
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(\"CURRENT_TIMESTAMP\"),
        },
      });

      // Create indexes for student_marks\n      await queryInterface.addIndex(\"student_marks\", [\"exam_format_id\"]);\n      await queryInterface.addIndex(\"student_marks\", [\"student_id\"]);\n\n      console.log(\"Migration up: Exam format tables created successfully\");\n    } catch (error) {\n      console.error(\"Migration error:\", error);\n      throw error;\n    }\n  },\n\n  down: async (queryInterface, Sequelize) => {\n    try {\n      // Drop tables in reverse order (due to foreign key constraints)\n      await queryInterface.dropTable(\"student_marks\");\n      await queryInterface.dropTable(\"exam_subjects\");\n      await queryInterface.dropTable(\"exam_formats\");\n\n      console.log(\"Migration down: Exam format tables dropped\");\n    } catch (error) {\n      console.error(\"Migration error:\", error);\n      throw error;\n    }\n  },\n};