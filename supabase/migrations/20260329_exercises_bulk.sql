-- Insertion massive d'exercices en français
-- ON CONFLICT DO NOTHING évite les doublons si la migration est rejouée

INSERT INTO exercises (name, muscle_group, equipment)
SELECT v.name, v.muscle_group, v.equipment
FROM (VALUES
  -- ═══════════════════════════════
  -- PECTORAUX
  -- ═══════════════════════════════
  ('Développé incliné haltères',           'Pectoraux', 'Haltères'),
  ('Développé décliné haltères',           'Pectoraux', 'Haltères'),
  ('Développé machine couché',             'Pectoraux', 'Machine'),
  ('Développé machine incliné',            'Pectoraux', 'Machine'),
  ('Écarté machine pectoraux',             'Pectoraux', 'Machine'),
  ('Écarté poulie haute',                  'Pectoraux', 'Câble'),
  ('Écarté poulie basse',                  'Pectoraux', 'Câble'),
  ('Écarté poulie croisée décliné',        'Pectoraux', 'Câble'),
  ('Pull-over machine',                    'Pectoraux', 'Machine'),
  ('Développé couché prise serrée',        'Pectoraux', 'Barre'),
  ('Pompes déclinées',                     'Pectoraux', 'Poids du corps'),
  ('Pompes inclinées',                     'Pectoraux', 'Poids du corps'),
  ('Pompes diamant',                       'Pectoraux', 'Poids du corps'),
  ('Dips barre parallèles',               'Pectoraux', 'Poids du corps'),
  ('Fly câble pectoraux',                  'Pectoraux', 'Câble'),

  -- ═══════════════════════════════
  -- DOS
  -- ═══════════════════════════════
  ('Tirage horizontal machine',            'Dos', 'Machine'),
  ('Tirage vertical prise neutre',         'Dos', 'Câble'),
  ('Tirage vertical prise supination',     'Dos', 'Câble'),
  ('Tirage buste penché câble',            'Dos', 'Câble'),
  ('Tirage horizontal unilatéral câble',   'Dos', 'Câble'),
  ('Rowing T-bar',                         'Dos', 'Barre'),
  ('Rowing barre prise supination',        'Dos', 'Barre'),
  ('Rowing machine assis',                 'Dos', 'Machine'),
  ('Rowing haltère prise supination',      'Dos', 'Haltères'),
  ('Tractions prise serrée',               'Dos', 'Poids du corps'),
  ('Tractions lestées',                    'Dos', 'Poids du corps'),
  ('Tractions prise neutre',               'Dos', 'Poids du corps'),
  ('Tirage poulie basse prise large',      'Dos', 'Câble'),
  ('Hyperextension',                       'Dos', 'Poids du corps'),
  ('Hyperextension lestée',                'Dos', 'Poids du corps'),
  ('Good morning',                         'Dos', 'Barre'),
  ('Rack pull',                            'Dos', 'Barre'),
  ('Soulevé de terre sumo',                'Dos', 'Barre'),
  ('Soulevé de terre haltères',            'Dos', 'Haltères'),
  ('Superman',                             'Dos', 'Poids du corps'),
  ('Shrugs haltères',                      'Dos', 'Haltères'),
  ('Rowing câble unilatéral',              'Dos', 'Câble'),

  -- ═══════════════════════════════
  -- ÉPAULES
  -- ═══════════════════════════════
  ('Développé Arnold',                     'Épaules', 'Haltères'),
  ('Développé haltères debout',            'Épaules', 'Haltères'),
  ('Élévations latérales câble',           'Épaules', 'Câble'),
  ('Élévations latérales machine',         'Épaules', 'Machine'),
  ('Élévations latérales incliné',         'Épaules', 'Haltères'),
  ('Élévations frontales barre',           'Épaules', 'Barre'),
  ('Élévations frontales câble',           'Épaules', 'Câble'),
  ('Élévations 45° haltères',              'Épaules', 'Haltères'),
  ('Rowing menton barre',                  'Épaules', 'Barre'),
  ('Rowing menton câble',                  'Épaules', 'Câble'),
  ('Rowing menton haltères',               'Épaules', 'Haltères'),
  ('Oiseau câble',                         'Épaules', 'Câble'),
  ('Rotations externes câble',             'Épaules', 'Câble'),
  ('Rotations internes câble',             'Épaules', 'Câble'),
  ('Rotations externes haltères',          'Épaules', 'Haltères'),
  ('Développé Smith machine',              'Épaules', 'Machine'),
  ('Haussements d''épaules haltères',      'Épaules', 'Haltères'),
  ('Haussements d''épaules câble',         'Épaules', 'Câble'),
  ('Élévations arrière machine',           'Épaules', 'Machine'),

  -- ═══════════════════════════════
  -- BICEPS
  -- ═══════════════════════════════
  ('Curl pupitre barre',                   'Biceps', 'Barre'),
  ('Curl pupitre barre EZ',                'Biceps', 'Barre'),
  ('Curl pupitre haltères',                'Biceps', 'Haltères'),
  ('Curl machine',                         'Biceps', 'Machine'),
  ('Curl câble bilatéral',                 'Biceps', 'Câble'),
  ('Curl câble unilatéral',                'Biceps', 'Câble'),
  ('Curl poulie haute',                    'Biceps', 'Câble'),
  ('Curl inverse barre',                   'Biceps', 'Barre'),
  ('Curl inverse barre EZ',                'Biceps', 'Barre'),
  ('Curl inverse haltères',                'Biceps', 'Haltères'),
  ('Zottman curl',                         'Biceps', 'Haltères'),
  ('21s barre',                            'Biceps', 'Barre'),
  ('Curl barre prise large',               'Biceps', 'Barre'),
  ('Curl barre prise serrée',              'Biceps', 'Barre'),
  ('Curl haltères simultané',              'Biceps', 'Haltères'),

  -- ═══════════════════════════════
  -- TRICEPS
  -- ═══════════════════════════════
  ('Barre au front barre EZ',              'Triceps', 'Barre'),
  ('Barre au front incliné',               'Triceps', 'Barre'),
  ('Close grip bench press',               'Triceps', 'Barre'),
  ('Push-down corde',                      'Triceps', 'Câble'),
  ('Push-down barre droite',               'Triceps', 'Câble'),
  ('Push-down barre V',                    'Triceps', 'Câble'),
  ('Extension overhead câble',             'Triceps', 'Câble'),
  ('Extension overhead corde',             'Triceps', 'Câble'),
  ('Extension haltère couché',             'Triceps', 'Haltères'),
  ('Extension triceps machine',            'Triceps', 'Machine'),
  ('Dips lestés',                          'Triceps', 'Poids du corps'),
  ('JM Press',                             'Triceps', 'Barre'),
  ('Triceps kickback câble',               'Triceps', 'Câble'),

  -- ═══════════════════════════════
  -- JAMBES / QUADRICEPS
  -- ═══════════════════════════════
  ('Squat bulgare barre',                  'Jambes', 'Barre'),
  ('Squat sumo',                           'Jambes', 'Barre'),
  ('Squat sumo haltères',                  'Jambes', 'Haltères'),
  ('Squat Smith machine',                  'Jambes', 'Machine'),
  ('Hack squat machine',                   'Jambes', 'Machine'),
  ('Hack squat barre',                     'Jambes', 'Barre'),
  ('Presse à jambes 45°',                  'Jambes', 'Machine'),
  ('Presse à jambes unilatérale',          'Jambes', 'Machine'),
  ('Extension jambes unilatérale',         'Jambes', 'Machine'),
  ('Fentes inversées haltères',            'Jambes', 'Haltères'),
  ('Fentes inversées barre',               'Jambes', 'Barre'),
  ('Fentes latérales',                     'Jambes', 'Haltères'),
  ('Fentes marchées barre',                'Jambes', 'Barre'),
  ('Fentes marchées haltères',             'Jambes', 'Haltères'),
  ('Step-up haltères',                     'Jambes', 'Haltères'),
  ('Step-up barre',                        'Jambes', 'Barre'),
  ('Leg curl debout machine',              'Jambes', 'Machine'),
  ('Nordic curl',                          'Jambes', 'Poids du corps'),
  ('Sissy squat',                          'Jambes', 'Poids du corps'),
  ('Soulevé de terre roumain haltères',    'Jambes', 'Haltères'),
  ('Good morning barre',                   'Jambes', 'Barre'),
  ('Hip thrust machine',                   'Jambes', 'Machine'),

  -- ═══════════════════════════════
  -- FESSIERS
  -- ═══════════════════════════════
  ('Abduction hanche machine',             'Fessiers', 'Machine'),
  ('Adduction hanche machine',             'Fessiers', 'Machine'),
  ('Donkey kicks câble',                   'Fessiers', 'Câble'),
  ('Donkey kicks élastique',               'Fessiers', 'Élastique'),
  ('Kickback câble',                       'Fessiers', 'Câble'),
  ('Glute bridge',                         'Fessiers', 'Poids du corps'),
  ('Glute bridge barre',                   'Fessiers', 'Barre'),
  ('Glute bridge haltères',                'Fessiers', 'Haltères'),
  ('Clamshell élastique',                  'Fessiers', 'Élastique'),
  ('Hip thrust haltères',                  'Fessiers', 'Haltères'),
  ('Fentes inversées barre fessiers',      'Fessiers', 'Barre'),
  ('RDL unilatéral haltères',              'Fessiers', 'Haltères'),

  -- ═══════════════════════════════
  -- MOLLETS
  -- ═══════════════════════════════
  ('Mollets debout unilatéral',            'Mollets', 'Poids du corps'),
  ('Mollets debout haltères',              'Mollets', 'Haltères'),
  ('Mollets debout barre',                 'Mollets', 'Barre'),
  ('Mollets assis haltères',               'Mollets', 'Haltères'),
  ('Mollets presse à jambes',              'Mollets', 'Machine'),
  ('Mollets donkey machine',               'Mollets', 'Machine'),
  ('Mollets debout unilatéral haltère',    'Mollets', 'Haltères'),
  ('Tibial anterior raises',               'Mollets', 'Poids du corps'),

  -- ═══════════════════════════════
  -- ABDOMINAUX
  -- ═══════════════════════════════
  ('Crunch inversé',                       'Abdominaux', 'Poids du corps'),
  ('Crunch machine',                       'Abdominaux', 'Machine'),
  ('Crunch câble',                         'Abdominaux', 'Câble'),
  ('Relevé de buste',                      'Abdominaux', 'Poids du corps'),
  ('Relevé de jambes banc incliné',        'Abdominaux', 'Poids du corps'),
  ('Roue abdominale',                      'Abdominaux', 'Poids du corps'),
  ('Mountain climber',                     'Abdominaux', 'Poids du corps'),
  ('Bicycle crunch',                       'Abdominaux', 'Poids du corps'),
  ('Dead bug',                             'Abdominaux', 'Poids du corps'),
  ('V-up',                                 'Abdominaux', 'Poids du corps'),
  ('Hollow body',                          'Abdominaux', 'Poids du corps'),
  ('Dragon flag',                          'Abdominaux', 'Poids du corps'),
  ('Windshield wipers',                    'Abdominaux', 'Poids du corps'),
  ('Toe touch',                            'Abdominaux', 'Poids du corps'),
  ('Gainage frontal dynamique',            'Abdominaux', 'Poids du corps'),
  ('Side plank with rotation',             'Abdominaux', 'Poids du corps'),
  ('Ab wheel rollout',                     'Abdominaux', 'Poids du corps'),

  -- ═══════════════════════════════
  -- AVANT-BRAS
  -- ═══════════════════════════════
  ('Curl poignets barre',                  'Avant-bras', 'Barre'),
  ('Extension poignets barre',             'Avant-bras', 'Barre'),
  ('Curl poignets haltères',               'Avant-bras', 'Haltères'),
  ('Extension poignets haltères',          'Avant-bras', 'Haltères'),
  ('Reverse curl barre',                   'Avant-bras', 'Barre'),
  ('Farmer''s walk',                       'Avant-bras', 'Haltères'),
  ('Dead hang',                            'Avant-bras', 'Poids du corps'),
  ('Pronation supination haltères',        'Avant-bras', 'Haltères'),

  -- ═══════════════════════════════
  -- FULL BODY / FONCTIONNEL
  -- ═══════════════════════════════
  ('Burpees',                              'Full body', 'Poids du corps'),
  ('Kettlebell swing',                     'Full body', 'Kettlebell'),
  ('Kettlebell snatch',                    'Full body', 'Kettlebell'),
  ('Kettlebell clean & press',             'Full body', 'Kettlebell'),
  ('Thrusters barre',                      'Full body', 'Barre'),
  ('Thrusters haltères',                   'Full body', 'Haltères'),
  ('Clean & jerk',                         'Full body', 'Barre'),
  ('Arraché',                              'Full body', 'Barre'),
  ('Box jump',                             'Full body', 'Poids du corps'),
  ('Battle ropes',                         'Full body', 'Autre'),
  ('Sled push',                            'Full body', 'Autre'),
  ('Tire flip',                            'Full body', 'Autre'),
  ('Wall ball',                            'Full body', 'Autre'),
  ('Sandbag carry',                        'Full body', 'Autre')

) AS v(name, muscle_group, equipment)
WHERE NOT EXISTS (
  SELECT 1 FROM exercises WHERE exercises.name = v.name
);
