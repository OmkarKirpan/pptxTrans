-- Health check table
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY
);

-- Translation sessions table
CREATE TABLE IF NOT EXISTS translation_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  slide_count INTEGER,
  result_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slides table
CREATE TABLE IF NOT EXISTS slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT REFERENCES translation_sessions(id),
  slide_number INTEGER NOT NULL,
  svg_url TEXT NOT NULL,
  original_width INTEGER NOT NULL,
  original_height INTEGER NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slide shapes table
CREATE TABLE IF NOT EXISTS slide_shapes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_id UUID REFERENCES slides(id),
  shape_id TEXT NOT NULL,
  shape_type TEXT NOT NULL,
  x_coordinate FLOAT NOT NULL,
  y_coordinate FLOAT NOT NULL,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  coordinates_unit TEXT NOT NULL,
  reading_order INTEGER NOT NULL,
  original_text TEXT,
  font_size FLOAT,
  font_family TEXT,
  font_weight TEXT,
  font_style TEXT,
  color TEXT,
  text_align TEXT,
  vertical_anchor TEXT,
  line_spacing FLOAT,
  image_content_type TEXT,
  image_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
