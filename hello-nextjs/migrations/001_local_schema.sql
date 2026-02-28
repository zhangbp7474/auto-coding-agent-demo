-- AI Video Project - Local PostgreSQL Schema
-- Migration: 001_local_schema
-- Description: Creates all tables, indexes, foreign keys for local PostgreSQL deployment

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE project_stage AS ENUM ('draft', 'scenes', 'images', 'videos', 'completed');
CREATE TYPE image_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE video_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================================================
-- USERS TABLE (Replaces Supabase Auth)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    story TEXT,
    style VARCHAR(100) NOT NULL DEFAULT 'default',
    stage project_stage NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_stage ON projects(stage);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- ============================================================================
-- SCENES TABLE
-- ============================================================================

CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    description TEXT NOT NULL,
    description_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    image_status image_status NOT NULL DEFAULT 'pending',
    image_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    video_status video_status NOT NULL DEFAULT 'pending',
    video_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_scenes_project_order ON scenes(project_id, order_index);
CREATE INDEX idx_scenes_project_id ON scenes(project_id);
CREATE INDEX idx_scenes_image_status ON scenes(image_status);
CREATE INDEX idx_scenes_video_status ON scenes(video_status);

-- ============================================================================
-- IMAGES TABLE
-- ============================================================================

CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_images_scene_id ON images(scene_id);
CREATE INDEX idx_images_version ON images(version);

-- ============================================================================
-- VIDEOS TABLE
-- ============================================================================

CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    duration FLOAT,
    task_id VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_scene_id ON videos(scene_id);
CREATE INDEX idx_videos_task_id ON videos(task_id);
CREATE INDEX idx_videos_version ON videos(version);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'Local users table replacing Supabase Auth';
COMMENT ON TABLE projects IS 'Projects created by users containing stories to be converted to videos';
COMMENT ON TABLE scenes IS 'Individual scenes/shots within a project, generated from story breakdown';
COMMENT ON TABLE images IS 'Generated images for each scene';
COMMENT ON TABLE videos IS 'Generated videos for each scene';

COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN projects.stage IS 'Current workflow stage: draft -> scenes -> images -> videos -> completed';
COMMENT ON COLUMN scenes.order_index IS 'Order of this scene in the project (0-based)';
COMMENT ON COLUMN scenes.description_confirmed IS 'Whether user has confirmed the scene description';
COMMENT ON COLUMN scenes.image_status IS 'Status of image generation for this scene';
COMMENT ON COLUMN scenes.image_confirmed IS 'Whether user has confirmed the generated image';
COMMENT ON COLUMN scenes.video_status IS 'Status of video generation for this scene';
COMMENT ON COLUMN scenes.video_confirmed IS 'Whether user has confirmed the generated video';
COMMENT ON COLUMN images.version IS 'Version number of the image (increments on regeneration)';
COMMENT ON COLUMN videos.version IS 'Version number of the video (increments on regeneration)';
COMMENT ON COLUMN videos.task_id IS 'External task ID from video generation API for status tracking';
