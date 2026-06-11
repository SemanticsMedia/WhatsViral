-- Seed the 20 launch cities
INSERT INTO cities (name, region, state, gt_geo, yt_region) VALUES
  ('Lucknow',       'north',   'Uttar Pradesh',  'IN-UP', 'IN'),
  ('Jaipur',        'north',   'Rajasthan',       'IN-RJ', 'IN'),
  ('Chandigarh',    'north',   'Chandigarh',      'IN-CH', 'IN'),
  ('Agra',          'north',   'Uttar Pradesh',   'IN-UP', 'IN'),
  ('Surat',         'west',    'Gujarat',         'IN-GJ', 'IN'),
  ('Nagpur',        'west',    'Maharashtra',     'IN-MH', 'IN'),
  ('Vadodara',      'west',    'Gujarat',         'IN-GJ', 'IN'),
  ('Nashik',        'west',    'Maharashtra',     'IN-MH', 'IN'),
  ('Coimbatore',    'south',   'Tamil Nadu',      'IN-TN', 'IN'),
  ('Kochi',         'south',   'Kerala',          'IN-KL', 'IN'),
  ('Visakhapatnam', 'south',   'Andhra Pradesh',  'IN-AP', 'IN'),
  ('Mysuru',        'south',   'Karnataka',       'IN-KA', 'IN'),
  ('Patna',         'east',    'Bihar',           'IN-BR', 'IN'),
  ('Bhubaneswar',   'east',    'Odisha',          'IN-OR', 'IN'),
  ('Guwahati',      'east',    'Assam',           'IN-AS', 'IN'),
  ('Ranchi',        'east',    'Jharkhand',       'IN-JH', 'IN'),
  ('Indore',        'central', 'Madhya Pradesh',  'IN-MP', 'IN'),
  ('Bhopal',        'central', 'Madhya Pradesh',  'IN-MP', 'IN'),
  ('Raipur',        'central', 'Chhattisgarh',    'IN-CT', 'IN'),
  ('Varanasi',      'central', 'Uttar Pradesh',   'IN-UP', 'IN')
ON CONFLICT (name) DO NOTHING;

-- Default global ViralScore weights
INSERT INTO viral_score_weights (city, category, weights) VALUES
  (NULL, NULL, '{
    "crossPlatformPresence": 25,
    "velocity": 20,
    "engagementQuality": 20,
    "geographicSpread": 15,
    "sourceDiversity": 10,
    "breakoutFactor": 10
  }')
ON CONFLICT (city, category) DO NOTHING;
