-- Pickleball Group Play Planning Database Schema

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS pulse_responses CASCADE;
DROP TABLE IF EXISTS pulses CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS group_locations CASCADE;
DROP TABLE IF EXISTS user_groups CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'member', 'admin')),
    level_of_play VARCHAR(20) CHECK (level_of_play IN ('beginner', 'intermediate', 'expert')),
    dupr_rating NUMERIC(3,1),
    certified_rating BOOLEAN DEFAULT false,
    default_group_id INTEGER,
    default_location_id INTEGER,
    usual_morning_start TIME DEFAULT '08:00',
    usual_evening_start TIME DEFAULT '18:00',
    usual_duration_min INTEGER DEFAULT 90,
    away_start_date DATE,
    away_end_date DATE,
    push_subscription JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    min_players INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User-Groups junction table
CREATE TABLE user_groups (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id)
);

-- Locations table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_spots INTEGER NOT NULL CHECK (max_spots > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reservations table
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0 AND guest_count <= 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id)
);

-- Group-Locations junction table
CREATE TABLE group_locations (
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, location_id)
);

-- Group join requests table
CREATE TABLE group_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, group_id)
);

-- Pulses ("Who's playing?" requests)
CREATE TABLE pulses (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    pulse_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- Only one active pulse per group at a time
CREATE UNIQUE INDEX one_active_pulse_per_group ON pulses (group_id) WHERE status = 'active';

-- Pulse responses (I'm in / I'm out)
CREATE TABLE pulse_responses (
    id SERIAL PRIMARY KEY,
    pulse_id INTEGER NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(8) NOT NULL CHECK (status IN ('in', 'out')),
    source VARCHAR(12) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_away')),
    responded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pulse_id, user_id)
);

-- Foreign keys for user defaults (added after locations/groups exist)
ALTER TABLE users ADD CONSTRAINT users_default_group_fk
    FOREIGN KEY (default_group_id) REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT users_default_location_fk
    FOREIGN KEY (default_location_id) REFERENCES locations(id) ON DELETE SET NULL;

-- Create indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX idx_events_group_id ON events(group_id);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_reservations_event_id ON reservations(event_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_group_locations_group_id ON group_locations(group_id);
CREATE INDEX idx_group_locations_location_id ON group_locations(location_id);
CREATE INDEX idx_group_requests_user_id ON group_requests(user_id);
CREATE INDEX idx_group_requests_group_id ON group_requests(group_id);
CREATE INDEX idx_pulses_group_status ON pulses(group_id, status);
CREATE INDEX idx_pulse_responses_pulse ON pulse_responses(pulse_id);
CREATE INDEX idx_pulse_responses_user ON pulse_responses(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
