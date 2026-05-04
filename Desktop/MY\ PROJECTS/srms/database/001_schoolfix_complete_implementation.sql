-- ====================================================================
-- SCHOOLFIX COMPLETE IMPLEMENTATION
-- Comprehensive Database Schema for 110+ Features
-- Version: 1.0
-- Date: 2026-05-04
-- ====================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ====================================================================
-- SECTION 1: SCHOOL SETUP & CONFIGURATION
-- ====================================================================

-- -------- Roles & Permissions --------
DROP TABLE IF EXISTS `tbl_roles`;
CREATE TABLE IF NOT EXISTS `tbl_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `description` text COLLATE utf8mb4_general_ci,
  `is_system_role` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_roles` (`name`, `description`, `is_system_role`) VALUES
('Admin', 'System Administrator', 1),
('Principal', 'School Principal', 1),
('Teacher', 'Teaching Staff', 1),
('Student', 'Student', 1),
('Parent', 'Parent/Guardian', 1),
('Accountant', 'Finance Manager', 1),
('Admin Assistant', 'Administrative Assistant', 0);

DROP TABLE IF EXISTS `tbl_permissions`;
CREATE TABLE IF NOT EXISTS `tbl_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `module` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `module_idx` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Permissions are inserted via PHP during initialization

DROP TABLE IF EXISTS `tbl_role_permissions`;
CREATE TABLE IF NOT EXISTS `tbl_role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_permission_unique` (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `tbl_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `tbl_permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_staff_roles`;
CREATE TABLE IF NOT EXISTS `tbl_staff_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `role_id` int NOT NULL,
  `assigned_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `assigned_by` int,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_role_unique` (`staff_id`, `role_id`),
  FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `tbl_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Academic Structure --------
DROP TABLE IF EXISTS `tbl_sections`;
CREATE TABLE IF NOT EXISTS `tbl_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `stream_letter` char(1) COLLATE utf8mb4_general_ci,
  `capacity` int DEFAULT 50,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_section_unique` (`class_id`, `name`),
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_class_teachers`;
CREATE TABLE IF NOT EXISTS `tbl_class_teachers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL,
  `section_id` int,
  `teacher_id` int NOT NULL,
  `assigned_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `is_primary` tinyint DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_teacher_unique` (`class_id`, `section_id`, `teacher_id`),
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `tbl_sections`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_class_subject_teacher`;
CREATE TABLE IF NOT EXISTS `tbl_class_subject_teacher` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL,
  `subject_id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `section_id` int,
  `assigned_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cst_unique` (`class_id`, `subject_id`, `teacher_id`, `section_id`),
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `tbl_sections`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Admission & Numbering --------
DROP TABLE IF EXISTS `tbl_admission_settings`;
CREATE TABLE IF NOT EXISTS `tbl_admission_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prefix` varchar(10) COLLATE utf8mb4_general_ci DEFAULT '',
  `current_number` int DEFAULT 1000,
  `format_pattern` varchar(50) COLLATE utf8mb4_general_ci DEFAULT '{PREFIX}{NUMBER}',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_admission_settings` VALUES (1, 'ADM', 1001, '{PREFIX}{NUMBER}', DEFAULT);

DROP TABLE IF EXISTS `tbl_no_series`;
CREATE TABLE IF NOT EXISTS `tbl_no_series` (
  `id` int NOT NULL AUTO_INCREMENT,
  `series_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `prefix` varchar(10) COLLATE utf8mb4_general_ci,
  `current_value` int DEFAULT 0,
  `increment` int DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Class Configuration --------
DROP TABLE IF EXISTS `tbl_class_types`;
CREATE TABLE IF NOT EXISTS `tbl_class_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `description` text COLLATE utf8mb4_general_ci,
  `level` enum('primary','secondary','junior','senior') DEFAULT 'secondary',
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_class_types` (`name`, `description`, `level`, `is_active`) VALUES
('Primary School', 'Primary Education', 'primary', 1),
('Junior School', 'Junior Secondary (Grades 7-9)', 'junior', 1),
('Senior School', 'Senior Secondary (Grades 10-12)', 'senior', 1);

-- -------- CBE/CBC Configuration --------
DROP TABLE IF EXISTS `tbl_cbe_strands`;
CREATE TABLE IF NOT EXISTS `tbl_cbe_strands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `colour_code` varchar(7) DEFAULT '#FF5733',
  `is_active` tinyint DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_cbe_strands` (`name`, `description`, `is_active`) VALUES
('STEAM', 'Science, Technology, Engineering, Arts, Mathematics', 1),
('Languages', 'Communication and Language Learning', 1),
('Social Studies', 'Social and Civic Learning', 1),
('Physical Education', 'Games, Sports, and PE', 1),
('Life Skills', 'Moral and Value Education', 1);

DROP TABLE IF EXISTS `tbl_cbe_settings`;
CREATE TABLE IF NOT EXISTS `tbl_cbe_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `setting_value` text COLLATE utf8mb4_general_ci,
  `description` text COLLATE utf8mb4_general_ci,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_cbe_settings` VALUES 
(1, 'cbe_enabled', '1', 'Enable CBE/CBC functionality', DEFAULT),
(2, 'grading_scale', 'competency', 'Grading scale type (competency/traditional)', DEFAULT),
(3, 'assessment_method', 'portfolio', 'Primary assessment method', DEFAULT);

-- -------- Workflows --------
DROP TABLE IF EXISTS `tbl_workflows`;
CREATE TABLE IF NOT EXISTS `tbl_workflows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `module` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `trigger_event` varchar(100) COLLATE utf8mb4_general_ci,
  `is_active` tinyint DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_workflow_steps`;
CREATE TABLE IF NOT EXISTS `tbl_workflow_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` int NOT NULL,
  `step_order` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci,
  `action_type` varchar(50) COLLATE utf8mb4_general_ci,
  `required_role_id` int,
  `description` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`workflow_id`) REFERENCES `tbl_workflows`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`required_role_id`) REFERENCES `tbl_roles`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_workflow_approvals`;
CREATE TABLE IF NOT EXISTS `tbl_workflow_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` int NOT NULL,
  `reference_table` varchar(50) COLLATE utf8mb4_general_ci,
  `reference_id` int,
  `current_step` int,
  `status` enum('pending','approved','rejected','on_hold') DEFAULT 'pending',
  `submitted_by` int,
  `submitted_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int,
  `approved_at` timestamp NULL,
  `comments` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`workflow_id`) REFERENCES `tbl_workflows`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`submitted_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 2: ACADEMICS & TIMETABLE
-- ====================================================================

DROP TABLE IF EXISTS `tbl_timetables`;
CREATE TABLE IF NOT EXISTS `tbl_timetables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `academic_year` int NOT NULL,
  `term` int DEFAULT 1,
  `school_id` int DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int,
  `is_active` tinyint DEFAULT 0,
  `status` enum('draft','generated','published','archived') DEFAULT 'draft',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_timetable_config`;
CREATE TABLE IF NOT EXISTS `tbl_timetable_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timetable_id` int NOT NULL,
  `days_per_week` int DEFAULT 5,
  `periods_per_day` int DEFAULT 8,
  `period_duration_minutes` int DEFAULT 40,
  `school_start_time` time DEFAULT '08:00:00',
  `school_end_time` time DEFAULT '16:00:00',
  `morning_break_start` time DEFAULT '10:00:00',
  `morning_break_end` time DEFAULT '10:20:00',
  `lunch_start` time DEFAULT '12:30:00',
  `lunch_end` time DEFAULT '13:30:00',
  `assembly_slot` varchar(20),
  `constraints_json` longtext,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`timetable_id`) REFERENCES `tbl_timetables`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_timetable_lessons`;
CREATE TABLE IF NOT EXISTS `tbl_timetable_lessons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timetable_id` int NOT NULL,
  `class_id` int NOT NULL,
  `section_id` int,
  `subject_id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `day_of_week` int NOT NULL COMMENT '1=Monday, 5=Friday',
  `period_slot` int NOT NULL,
  `room_id` int,
  `is_double_period` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lesson_unique` (`timetable_id`, `class_id`, `section_id`, `day_of_week`, `period_slot`),
  FOREIGN KEY (`timetable_id`) REFERENCES `tbl_timetables`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `tbl_sections`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`room_id`) REFERENCES `tbl_rooms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_rooms`;
CREATE TABLE IF NOT EXISTS `tbl_rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `room_type` varchar(50) DEFAULT 'classroom',
  `capacity` int DEFAULT 40,
  `is_available` tinyint DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Online Learning --------
DROP TABLE IF EXISTS `tbl_online_quizzes`;
CREATE TABLE IF NOT EXISTS `tbl_online_quizzes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `subject_id` int,
  `class_id` int,
  `teacher_id` int NOT NULL,
  `total_questions` int DEFAULT 0,
  `total_points` int DEFAULT 100,
  `time_limit_minutes` int DEFAULT 60,
  `passing_score` int DEFAULT 50,
  `shuffle_questions` tinyint DEFAULT 0,
  `show_answers` tinyint DEFAULT 1,
  `is_published` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `teacher_idx` (`teacher_id`),
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_quiz_questions`;
CREATE TABLE IF NOT EXISTS `tbl_quiz_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `question_number` int,
  `question_text` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `question_type` enum('multiple_choice','short_answer','essay','true_false','matching') DEFAULT 'multiple_choice',
  `points` int DEFAULT 1,
  `correct_answer` longtext COLLATE utf8mb4_general_ci,
  `explanation` longtext COLLATE utf8mb4_general_ci,
  `image_url` varchar(255),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`quiz_id`) REFERENCES `tbl_online_quizzes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_quiz_options`;
CREATE TABLE IF NOT EXISTS `tbl_quiz_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int NOT NULL,
  `option_text` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `option_order` int,
  `is_correct` tinyint DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`question_id`) REFERENCES `tbl_quiz_questions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_quiz_submissions`;
CREATE TABLE IF NOT EXISTS `tbl_quiz_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `student_id` int NOT NULL,
  `started_at` timestamp,
  `submitted_at` timestamp NULL,
  `total_score` int,
  `percentage` int,
  `status` enum('in_progress','submitted','graded') DEFAULT 'in_progress',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`quiz_id`) REFERENCES `tbl_online_quizzes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_quiz_answers`;
CREATE TABLE IF NOT EXISTS `tbl_quiz_answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `question_id` int NOT NULL,
  `answer_text` longtext COLLATE utf8mb4_general_ci,
  `is_correct` tinyint,
  `points_earned` int,
  `answered_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`submission_id`) REFERENCES `tbl_quiz_submissions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`question_id`) REFERENCES `tbl_quiz_questions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Assignments --------
DROP TABLE IF EXISTS `tbl_assignments`;
CREATE TABLE IF NOT EXISTS `tbl_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `subject_id` int,
  `class_id` int,
  `teacher_id` int NOT NULL,
  `issued_date` date,
  `due_date` date NOT NULL,
  `total_marks` int DEFAULT 100,
  `rubric` longtext,
  `is_published` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_assignment_submissions`;
CREATE TABLE IF NOT EXISTS `tbl_assignment_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assignment_id` int NOT NULL,
  `student_id` int NOT NULL,
  `submission_date` timestamp DEFAULT CURRENT_TIMESTAMP,
  `file_path` varchar(255),
  `comments` longtext COLLATE utf8mb4_general_ci,
  `marks_obtained` int,
  `feedback` longtext COLLATE utf8mb4_general_ci,
  `graded_by` int,
  `graded_at` timestamp NULL,
  `status` enum('submitted','graded','overdue') DEFAULT 'submitted',
  PRIMARY KEY (`id`),
  UNIQUE KEY `submission_unique` (`assignment_id`, `student_id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `tbl_assignments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`graded_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Materials --------
DROP TABLE IF EXISTS `tbl_revision_materials`;
CREATE TABLE IF NOT EXISTS `tbl_revision_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `subject_id` int,
  `class_id` int,
  `uploaded_by` int NOT NULL,
  `file_path` varchar(255),
  `file_type` varchar(20),
  `file_size` bigint,
  `is_published` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`uploaded_by`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_school_materials`;
CREATE TABLE IF NOT EXISTS `tbl_school_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `category` varchar(100) COLLATE utf8mb4_general_ci,
  `uploaded_by` int NOT NULL,
  `file_path` varchar(255),
  `file_type` varchar(20),
  `file_size` bigint,
  `is_published` tinyint DEFAULT 0,
  `access_level` enum('public','teachers','parents','students') DEFAULT 'public',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`uploaded_by`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 3: MARKS & GRADING
-- ====================================================================

DROP TABLE IF EXISTS `tbl_marks_submissions`;
CREATE TABLE IF NOT EXISTS `tbl_marks_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `class_id` int NOT NULL,
  `section_id` int,
  `subject_id` int NOT NULL,
  `submitted_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `total_students` int,
  `status` enum('draft','submitted','approved','published','rejected') DEFAULT 'draft',
  `submitted_by` int,
  PRIMARY KEY (`id`),
  UNIQUE KEY `submission_unique` (`exam_id`, `teacher_id`, `class_id`, `subject_id`),
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exam_results`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`submitted_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_marks_approval`;
CREATE TABLE IF NOT EXISTS `tbl_marks_approval` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `status` enum('pending','approved','rejected','on_hold') DEFAULT 'pending',
  `approved_at` timestamp NULL,
  `comments` longtext COLLATE utf8mb4_general_ci,
  `approval_level` int DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`submission_id`) REFERENCES `tbl_marks_submissions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approver_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_marks_edit_requests`;
CREATE TABLE IF NOT EXISTS `tbl_marks_edit_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `student_id` int NOT NULL,
  `subject_id` int NOT NULL,
  `old_marks` int,
  `new_marks` int NOT NULL,
  `reason` text COLLATE utf8mb4_general_ci,
  `requested_by` int NOT NULL,
  `approved_by` int,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `requested_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `approved_at` timestamp NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exam_results`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requested_by`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_marks_edit_logs`;
CREATE TABLE IF NOT EXISTS `tbl_marks_edit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `student_id` int NOT NULL,
  `subject_id` int NOT NULL,
  `old_marks` int,
  `new_marks` int,
  `changed_by` int NOT NULL,
  `change_reason` text COLLATE utf8mb4_general_ci,
  `changed_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `exam_student_idx` (`exam_id`, `student_id`),
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exam_results`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`changed_by`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Exams --------
DROP TABLE IF EXISTS `tbl_exams`;
CREATE TABLE IF NOT EXISTS `tbl_exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `start_date` date,
  `end_date` date,
  `exam_type` enum('mid_term','end_term','mock','internal','national') DEFAULT 'internal',
  `term` int,
  `year` int,
  `is_published` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_by` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_exam_sections`;
CREATE TABLE IF NOT EXISTS `tbl_exam_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `class_id` int NOT NULL,
  `section_id` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `exam_class_unique` (`exam_id`, `class_id`, `section_id`),
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`) REFERENCES `tbl_sections`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_exam_tabulations`;
CREATE TABLE IF NOT EXISTS `tbl_exam_tabulations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `student_id` int NOT NULL,
  `total_marks` int DEFAULT 0,
  `grade` varchar(5) DEFAULT 'U',
  `position` int,
  `mean_score` decimal(5,2),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `exam_student_unique` (`exam_id`, `student_id`),
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_exam_pins`;
CREATE TABLE IF NOT EXISTS `tbl_exam_pins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `student_id` int NOT NULL,
  `pin_code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `is_used` tinyint DEFAULT 0,
  `used_at` timestamp NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Attendance --------
DROP TABLE IF EXISTS `tbl_attendance`;
CREATE TABLE IF NOT EXISTS `tbl_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `class_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `status` enum('present','absent','late','excused') DEFAULT 'absent',
  `reason` varchar(255),
  `marked_by` int,
  `marked_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_unique` (`student_id`, `class_id`, `attendance_date`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`marked_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Report Cards --------
DROP TABLE IF EXISTS `tbl_report_card_subjects`;
CREATE TABLE IF NOT EXISTS `tbl_report_card_subjects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subject_id` int NOT NULL,
  `report_card_type` enum('cbc','traditional') DEFAULT 'cbc',
  `is_mandatory` tinyint DEFAULT 1,
  `display_order` int DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_report_cards`;
CREATE TABLE IF NOT EXISTS `tbl_report_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `class_id` int NOT NULL,
  `exam_id` int,
  `generated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `generated_by` int,
  `is_published` tinyint DEFAULT 0,
  `published_at` timestamp NULL,
  `pdf_path` varchar(255),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exams`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`generated_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_cbc_competencies`;
CREATE TABLE IF NOT EXISTS `tbl_cbc_competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `subject_id` int NOT NULL,
  `exam_id` int,
  `strand_id` int,
  `competency_name` varchar(200),
  `achievement_level` enum('exceeding','meeting','developing','beginning') DEFAULT 'developing',
  `comments` text,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `tbl_subjects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`exam_id`) REFERENCES `tbl_exams`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`strand_id`) REFERENCES `tbl_cbe_strands`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- National Exams --------
DROP TABLE IF EXISTS `tbl_national_exams`;
CREATE TABLE IF NOT EXISTS `tbl_national_exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `exam_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `exam_date` date,
  `exam_type` enum('kpsea','kjsea','knec') DEFAULT 'knec',
  `registration_deadline` date,
  `is_completed` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_national_exams` (`exam_code`, `exam_name`, `exam_type`) VALUES
('KPSEA', 'Kenya Primary School Examination Authority', 'kpsea'),
('KJSEA', 'Kenya Junior School Examination Authority', 'kjsea'),
('KCSE', 'Kenya Certificate of Secondary Education', 'knec'),
('KCE', 'Kenya Certificate of Education', 'knec');

DROP TABLE IF EXISTS `tbl_junior_school_exams`;
CREATE TABLE IF NOT EXISTS `tbl_junior_school_exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `national_exam_id` int NOT NULL,
  `exam_date` date,
  `marks_obtained` int,
  `grade` varchar(5),
  `attempt_number` int DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`national_exam_id`) REFERENCES `tbl_national_exams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 4: STUDENTS
-- ====================================================================

DROP TABLE IF EXISTS `tbl_student_promotions`;
CREATE TABLE IF NOT EXISTS `tbl_student_promotions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `from_class_id` int NOT NULL,
  `to_class_id` int NOT NULL,
  `academic_year` int,
  `promotion_date` date,
  `promotion_type` enum('normal','special','hold_over','transfer') DEFAULT 'normal',
  `promoted_by` int,
  `comments` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`promoted_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_student_transfers`;
CREATE TABLE IF NOT EXISTS `tbl_student_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `from_section_id` int,
  `to_section_id` int NOT NULL,
  `transfer_date` date,
  `transfer_reason` varchar(255),
  `transfer_by` int,
  `approved_by` int,
  `status` enum('pending','approved','rejected','completed') DEFAULT 'pending',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_section_id`) REFERENCES `tbl_sections`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`to_section_id`) REFERENCES `tbl_sections`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`transfer_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_learner_profiles`;
CREATE TABLE IF NOT EXISTS `tbl_learner_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL UNIQUE,
  `learning_style` varchar(50),
  `strengths` longtext COLLATE utf8mb4_general_ci,
  `weaknesses` longtext COLLATE utf8mb4_general_ci,
  `interests` longtext COLLATE utf8mb4_general_ci,
  `behavioural_notes` longtext COLLATE utf8mb4_general_ci,
  `special_needs` longtext COLLATE utf8mb4_general_ci,
  `additional_support` text COLLATE utf8mb4_general_ci,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`updated_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_pathway_analysis`;
CREATE TABLE IF NOT EXISTS `tbl_pathway_analysis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `academic_year` int,
  `stem_aptitude_score` decimal(5,2),
  `arts_aptitude_score` decimal(5,2),
  `commerce_aptitude_score` decimal(5,2),
  `recommended_pathway` varchar(100),
  `confidence_level` decimal(3,2),
  `analysis_date` timestamp DEFAULT CURRENT_TIMESTAMP,
  `analyzed_by` int,
  `detailed_recommendations` longtext COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`analyzed_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_cbc_assessments`;
CREATE TABLE IF NOT EXISTS `tbl_cbc_assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `assessment_date` date,
  `assessment_type` varchar(50),
  `competency` varchar(200),
  `achievement_level` enum('exceeding','meeting','developing','beginning') DEFAULT 'developing',
  `evidence` longtext COLLATE utf8mb4_general_ci,
  `teacher_id` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 5: STAFF MANAGEMENT
-- ====================================================================

DROP TABLE IF EXISTS `tbl_departments`;
CREATE TABLE IF NOT EXISTS `tbl_departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `description` longtext COLLATE utf8mb4_general_ci,
  `head_id` int,
  `budget_allocation` decimal(12,2),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`head_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_departments` (`name`, `description`) VALUES
('Mathematics', 'Mathematics Department'),
('English', 'English & Literature Department'),
('Sciences', 'Science Department'),
('Social Studies', 'Social Studies Department'),
('IT/Computer Studies', 'Information Technology Department');

DROP TABLE IF EXISTS `tbl_positions`;
CREATE TABLE IF NOT EXISTS `tbl_positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `description` longtext COLLATE utf8mb4_general_ci,
  `salary_scale` decimal(12,2),
  `job_category` varchar(50),
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_positions` (`name`, `description`, `job_category`) VALUES
('Principal', 'School Principal', 'Management'),
('Deputy Principal', 'Deputy Principal', 'Management'),
('Head of Department', 'Department Head', 'Management'),
('Teacher', 'Teaching Staff', 'Teaching'),
('Accountant', 'Accounting Staff', 'Finance'),
('Librarian', 'Library Staff', 'Support');

DROP TABLE IF EXISTS `tbl_department_positions`;
CREATE TABLE IF NOT EXISTS `tbl_department_positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int NOT NULL,
  `position_id` int NOT NULL,
  `number_of_positions` int DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dept_pos_unique` (`department_id`, `position_id`),
  FOREIGN KEY (`department_id`) REFERENCES `tbl_departments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`position_id`) REFERENCES `tbl_positions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_department_leadership`;
CREATE TABLE IF NOT EXISTS `tbl_department_leadership` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int NOT NULL,
  `staff_id` int NOT NULL,
  `role` enum('chairman','secretary','treasurer','member') DEFAULT 'member',
  `started_date` date,
  `end_date` date,
  `is_current` tinyint DEFAULT 1,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`department_id`) REFERENCES `tbl_departments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_department_activities`;
CREATE TABLE IF NOT EXISTS `tbl_department_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int NOT NULL,
  `activity_name` varchar(200) COLLATE utf8mb4_general_ci,
  `activity_date` date,
  `description` longtext COLLATE utf8mb4_general_ci,
  `attendees_count` int,
  `outcome` longtext COLLATE utf8mb4_general_ci,
  `recorded_by` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`department_id`) REFERENCES `tbl_departments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_staff_appraisals`;
CREATE TABLE IF NOT EXISTS `tbl_staff_appraisals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `appraisal_period` varchar(20),
  `appraisal_date` date,
  `appraisal_score` decimal(5,2),
  `appraisal_grade` varchar(2),
  `self_assessment` longtext COLLATE utf8mb4_general_ci,
  `supervisor_comments` longtext COLLATE utf8mb4_general_ci,
  `appraiser_id` int,
  `status` enum('draft','submitted','completed') DEFAULT 'draft',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`appraiser_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_leave_requests`;
CREATE TABLE IF NOT EXISTS `tbl_leave_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `leave_type` enum('annual','sick','compassionate','study','unpaid','sabbatical') DEFAULT 'annual',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `number_of_days` int,
  `reason` longtext COLLATE utf8mb4_general_ci,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `requested_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int,
  `approved_at` timestamp NULL,
  `approval_comments` text COLLATE utf8mb4_general_ci,
  `coverage_notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_staff_performance`;
CREATE TABLE IF NOT EXISTS `tbl_staff_performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `metric_type` varchar(100),
  `metric_value` decimal(8,2),
  `benchmark_value` decimal(8,2),
  `performance_date` date,
  `notes` longtext COLLATE utf8mb4_general_ci,
  `recorded_by` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`staff_id`) REFERENCES `tbl_staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 6: BOARDING MANAGEMENT
-- ====================================================================

DROP TABLE IF EXISTS `tbl_dorms`;
CREATE TABLE IF NOT EXISTS `tbl_dorms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `dorm_type` enum('boys','girls','mixed') DEFAULT 'boys',
  `total_capacity` int,
  `current_occupancy` int DEFAULT 0,
  `housemaster_id` int,
  `hostel_matron_id` int,
  `description` longtext COLLATE utf8mb4_general_ci,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`housemaster_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`hostel_matron_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_dorm_rooms`;
CREATE TABLE IF NOT EXISTS `tbl_dorm_rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dorm_id` int NOT NULL,
  `room_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `room_capacity` int DEFAULT 4,
  `current_occupancy` int DEFAULT 0,
  `floor_number` int,
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_unique` (`dorm_id`, `room_number`),
  FOREIGN KEY (`dorm_id`) REFERENCES `tbl_dorms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_student_dorms`;
CREATE TABLE IF NOT EXISTS `tbl_student_dorms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `dorm_id` int NOT NULL,
  `room_id` int NOT NULL,
  `academic_year` int,
  `check_in_date` date,
  `check_out_date` date,
  `is_current` tinyint DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_dorm_unique` (`student_id`, `academic_year`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`dorm_id`) REFERENCES `tbl_dorms`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`room_id`) REFERENCES `tbl_dorm_rooms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 7: FINANCE
-- ====================================================================

DROP TABLE IF EXISTS `tbl_fee_structures`;
CREATE TABLE IF NOT EXISTS `tbl_fee_structures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `academic_year` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_fee_items`;
CREATE TABLE IF NOT EXISTS `tbl_fee_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fee_structure_id` int NOT NULL,
  `class_id` int,
  `item_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `item_amount` decimal(12,2) NOT NULL,
  `payment_frequency` enum('one_time','termly','monthly','annually') DEFAULT 'termly',
  `is_mandatory` tinyint DEFAULT 1,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`fee_structure_id`) REFERENCES `tbl_fee_structures`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `tbl_classes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_billing_cycles`;
CREATE TABLE IF NOT EXISTS `tbl_billing_cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `academic_year` int,
  `term` int,
  `start_date` date,
  `end_date` date,
  `payment_due_date` date,
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_financial_years`;
CREATE TABLE IF NOT EXISTS `tbl_financial_years` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fiscal_year` varchar(20) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `start_date` date,
  `end_date` date,
  `is_active` tinyint DEFAULT 0,
  `is_closed` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_chart_of_accounts`;
CREATE TABLE IF NOT EXISTS `tbl_chart_of_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `account_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `account_type` enum('asset','liability','equity','income','expense') NOT NULL,
  `account_category` varchar(50),
  `normal_balance` enum('debit','credit') DEFAULT 'debit',
  `opening_balance` decimal(15,2),
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_payment_methods`;
CREATE TABLE IF NOT EXISTS `tbl_payment_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `payment_type` enum('cash','bank_transfer','cheque','mpesa','card','credit') DEFAULT 'cash',
  `is_active` tinyint DEFAULT 1,
  `requires_reference` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_payment_methods` (`name`, `payment_type`, `is_active`) VALUES
('Cash', 'cash', 1),
('Bank Transfer', 'bank_transfer', 1),
('M-Pesa', 'mpesa', 1),
('Cheque', 'cheque', 1),
('Credit Card', 'card', 1);

DROP TABLE IF EXISTS `tbl_student_invoices`;
CREATE TABLE IF NOT EXISTS `tbl_student_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `invoice_number` varchar(50) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `invoice_date` date,
  `due_date` date,
  `total_amount` decimal(12,2),
  `amount_paid` decimal(12,2) DEFAULT 0,
  `balance_due` decimal(12,2),
  `status` enum('draft','sent','partial','paid','overdue','cancelled') DEFAULT 'draft',
  `pdf_path` varchar(255),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_by` int,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number_unique` (`invoice_number`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_invoice_items`;
CREATE TABLE IF NOT EXISTS `tbl_invoice_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `item_description` varchar(200),
  `quantity` int DEFAULT 1,
  `unit_price` decimal(12,2),
  `line_total` decimal(12,2),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`invoice_id`) REFERENCES `tbl_student_invoices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_payments`;
CREATE TABLE IF NOT EXISTS `tbl_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `invoice_id` int,
  `payment_date` date NOT NULL,
  `payment_method_id` int,
  `amount_paid` decimal(12,2) NOT NULL,
  `payment_reference` varchar(100),
  `payer_name` varchar(100),
  `receipt_number` varchar(50) COLLATE utf8mb4_general_ci UNIQUE,
  `receipt_pdf_path` varchar(255),
  `balance_after_payment` decimal(12,2),
  `notes` text COLLATE utf8mb4_general_ci,
  `recorded_by` int,
  `recorded_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invoice_id`) REFERENCES `tbl_student_invoices`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`payment_method_id`) REFERENCES `tbl_payment_methods`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`recorded_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_student_accounts`;
CREATE TABLE IF NOT EXISTS `tbl_student_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL UNIQUE,
  `total_billed` decimal(15,2) DEFAULT 0,
  `total_paid` decimal(15,2) DEFAULT 0,
  `total_balance` decimal(15,2) DEFAULT 0,
  `number_of_invoices` int DEFAULT 0,
  `last_payment_date` date,
  `account_status` enum('active','suspended','cleared') DEFAULT 'active',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_bursaries`;
CREATE TABLE IF NOT EXISTS `tbl_bursaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `bursary_type` enum('government','sponsor','scholarship') DEFAULT 'government',
  `amount_allocated` decimal(12,2),
  `amount_disbursed` decimal(12,2) DEFAULT 0,
  `academic_year` int,
  `approval_date` date,
  `approved_by` int,
  `status` enum('pending','approved','active','completed') DEFAULT 'pending',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_sponsors`;
CREATE TABLE IF NOT EXISTS `tbl_sponsors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sponsor_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `sponsor_type` enum('individual','organization','ngo') DEFAULT 'individual',
  `contact_email` varchar(100),
  `contact_phone` varchar(20),
  `address` longtext COLLATE utf8mb4_general_ci,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_student_sponsorships`;
CREATE TABLE IF NOT EXISTS `tbl_student_sponsorships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `sponsor_id` int NOT NULL,
  `sponsorship_amount` decimal(12,2),
  `payment_frequency` varchar(20),
  `start_date` date,
  `end_date` date,
  `reason` longtext COLLATE utf8mb4_general_ci,
  `status` enum('active','completed','terminated') DEFAULT 'active',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sponsor_id`) REFERENCES `tbl_sponsors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_fee_discounts`;
CREATE TABLE IF NOT EXISTS `tbl_fee_discounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `discount_type` enum('percentage','fixed_amount','scholarship',  'sibling','merit') DEFAULT 'percentage',
  `discount_value` decimal(8,2),
  `description` longtext COLLATE utf8mb4_general_ci,
  `criteria` longtext COLLATE utf8mb4_general_ci,
  `is_active` tinyint DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_student_discounts`;
CREATE TABLE IF NOT EXISTS `tbl_student_discounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `discount_id` int NOT NULL,
  `academic_year` int,
  `approved_by` int,
  `approved_date` date,
  `reason` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`discount_id`) REFERENCES `tbl_fee_discounts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Accounting Books --------
DROP TABLE IF EXISTS `tbl_journal_entries`;
CREATE TABLE IF NOT EXISTS `tbl_journal_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_date` date NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `reference_number` varchar(50),
  `created_by` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `posted_at` timestamp NULL,
  `posted_by` int,
  `status` enum('draft','posted','reversed') DEFAULT 'draft',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`posted_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_journal_lines`;
CREATE TABLE IF NOT EXISTS `tbl_journal_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_entry_id` int NOT NULL,
  `account_id` int NOT NULL,
  `debit_amount` decimal(15,2) DEFAULT 0,
  `credit_amount` decimal(15,2) DEFAULT 0,
  `description` varchar(255),
  `line_order` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`journal_entry_id`) REFERENCES `tbl_journal_entries`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`account_id`) REFERENCES `tbl_chart_of_accounts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_ledger`;
CREATE TABLE IF NOT EXISTS `tbl_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` int NOT NULL,
  `transaction_date` date NOT NULL,
  `description` varchar(255),
  `debit` decimal(15,2) DEFAULT 0,
  `credit` decimal(15,2) DEFAULT 0,
  `running_balance` decimal(15,2),
  `journal_line_id` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_date_idx` (`account_id`, `transaction_date`),
  FOREIGN KEY (`account_id`) REFERENCES `tbl_chart_of_accounts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`journal_line_id`) REFERENCES `tbl_journal_lines`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------- Expenditure --------
DROP TABLE IF EXISTS `tbl_expense_vouchers`;
CREATE TABLE IF NOT EXISTS `tbl_expense_vouchers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `voucher_number` varchar(50) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `voucher_date` date,
  `expense_category_id` int,
  `supplier_id` int,
  `cost_center_id` int,
  `amount` decimal(12,2),
  `payment_method_id` int,
  `description` longtext COLLATE utf8mb4_general_ci,
  `status` enum('draft','approved','paid','rejected') DEFAULT 'draft',
  `requested_by` int,
  `approved_by` int,
  `approved_date` date,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`expense_category_id`) REFERENCES `tbl_expense_categories`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `tbl_suppliers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`cost_center_id`) REFERENCES `tbl_cost_centers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`payment_method_id`) REFERENCES `tbl_payment_methods`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`requested_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`approved_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_expense_categories`;
CREATE TABLE IF NOT EXISTS `tbl_expense_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `description` longtext COLLATE utf8mb4_general_ci,
  `account_code` varchar(20),
  `budget_limit` decimal(12,2),
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_expense_categories` (`category_name`, `description`, `is_active`) VALUES
('Staff Salaries', 'Staff Payroll', 1),
('Utilities', 'Electricity, Water, Fuel', 1),
('Maintenance', 'Building & Equipment Maintenance', 1),
('Supplies', 'Office & Teaching Supplies', 1),
('Technology', 'IT Equipment & Services', 1),
('Travel', 'Transport & Travel Expenses', 1),
('Professional Development', 'Training & Development', 1);

DROP TABLE IF EXISTS `tbl_suppliers`;
CREATE TABLE IF NOT EXISTS `tbl_suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `contact_person` varchar(100),
  `email` varchar(100),
  `phone` varchar(20),
  `address` longtext COLLATE utf8mb4_general_ci,
  `payment_terms` varchar(100),
  `is_active` tinyint DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_cost_centers`;
CREATE TABLE IF NOT EXISTS `tbl_cost_centers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cost_center_code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `cost_center_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_general_ci,
  `budget_allocation` decimal(15,2),
  `responsible_person_id` int,
  `is_active` tinyint DEFAULT 1,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`responsible_person_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 8: EVENTS & COMMUNICATION
-- ====================================================================

DROP TABLE IF EXISTS `tbl_school_events`;
CREATE TABLE IF NOT EXISTS `tbl_school_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `event_date` date NOT NULL,
  `start_time` time,
  `end_time` time,
  `event_category` varchar(100),
  `description` longtext COLLATE utf8mb4_general_ci,
  `location` varchar(255),
  `organizer_id` int,
  `expected_attendees` int,
  `is_published` tinyint DEFAULT 0,
  `notify_parents` tinyint DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_by` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`organizer_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_sms_messages`;
CREATE TABLE IF NOT EXISTS `tbl_sms_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recipient_type` enum('student','parent','teacher','staff','all') NOT NULL,
  `recipient_id` int,
  `recipient_phone` varchar(20),
  `message_body` varchar(160) COLLATE utf8mb4_general_ci NOT NULL,
  `message_type` enum('notification','payment_reminder','event','announcement','custom') DEFAULT 'custom',
  `created_by` int,
  `scheduled_time` timestamp NULL,
  `sent_time` timestamp NULL,
  `delivery_status` enum('pending','sent','failed','delivered') DEFAULT 'pending',
  `cost` decimal(8,2),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_sms_templates`;
CREATE TABLE IF NOT EXISTS `tbl_sms_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  `template_category` varchar(50),
  `message_body` varchar(160) COLLATE utf8mb4_general_ci NOT NULL,
  `variables` varchar(255),
  `is_active` tinyint DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_sms_templates` (`template_name`, `template_category`, `message_body`, `variables`, `is_active`) VALUES
('Payment Reminder', 'finance', 'Dear Parent, {STUDENT_NAME} has outstanding balance of KES {AMOUNT}. Please pay by {DUE_DATE}.', '{STUDENT_NAME},{AMOUNT},{DUE_DATE}', 1),
('Absent Notice', 'attendance', '{STUDENT_NAME} was absent on {DATE}. Please contact school for details.', '{STUDENT_NAME},{DATE}', 1);

-- ====================================================================
-- SECTION 9: AUDIT & SYSTEM LOGS
-- ====================================================================

DROP TABLE IF EXISTS `tbl_audit_logs`;
CREATE TABLE IF NOT EXISTS `tbl_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int,
  `action_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_general_ci,
  `record_type` varchar(50),
  `record_id` int,
  `old_value` longtext COLLATE utf8mb4_general_ci,
  `new_value` longtext COLLATE utf8mb4_general_ci,
  `ip_address` varchar(45),
  `user_agent` varchar(255),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_module_idx` (`user_id`, `module`),
  KEY `created_at_idx` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_data_cleanup_logs`;
CREATE TABLE IF NOT EXISTS `tbl_data_cleanup_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cleanup_date` timestamp DEFAULT CURRENT_TIMESTAMP,
  `cleanup_type` varchar(100),
  `records_affected` int,
  `action_details` longtext COLLATE utf8mb4_general_ci,
  `performed_by` int,
  `status` enum('completed','failed','partial') DEFAULT 'completed',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`performed_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_recycle_bin`;
CREATE TABLE IF NOT EXISTS `tbl_recycle_bin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `record_type` varchar(50) NOT NULL,
  `record_id` int NOT NULL,
  `original_data` longtext COLLATE utf8mb4_general_ci,
  `deleted_by` int,
  `deleted_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `days_to_permanent_delete` int DEFAULT 30,
  `restore_available_until` date,
  `permanently_deleted` tinyint DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`deleted_by`) REFERENCES `tbl_staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- SECTION 10: MPESA INTEGRATION
-- ====================================================================

DROP TABLE IF EXISTS `tbl_mpesa_transactions`;
CREATE TABLE IF NOT EXISTS `tbl_mpesa_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpesa_receipt_number` varchar(20) COLLATE utf8mb4_general_ci UNIQUE,
  `student_id` int,
  `amount` decimal(12,2),
  `transaction_date` timestamp,
  `phone_number` varchar(20),
  `account_reference` varchar(100),
  `sender_name` varchar(100),
  `status` enum('pending','completed','failed') DEFAULT 'pending',
  `result_code` varchar(10),
  `result_description` longtext,
  `callback_received` tinyint DEFAULT 0,
  `matched_to_invoice` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `tbl_students`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`matched_to_invoice`) REFERENCES `tbl_student_invoices`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ====================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ====================================================================

CREATE INDEX idx_student_class ON `tbl_students`(`class_id`);
CREATE INDEX idx_staff_department ON `tbl_staff`(`department`) IF NOT EXISTS;
CREATE INDEX idx_exam_results_student ON `tbl_exam_results`(`student`);
CREATE INDEX idx_marks_submission_status ON `tbl_marks_submissions`(`status`);
CREATE INDEX idx_invoice_status ON `tbl_student_invoices`(`status`);
CREATE INDEX idx_payment_date ON `tbl_payments`(`payment_date`);
CREATE INDEX idx_journal_date ON `tbl_journal_entries`(`journal_date`);
CREATE INDEX idx_audit_created ON `tbl_audit_logs`(`created_at`);
CREATE INDEX idx_timetable_active ON `tbl_timetables`(`is_active`);
CREATE INDEX idx_sms_status ON `tbl_sms_messages`(`delivery_status`);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
