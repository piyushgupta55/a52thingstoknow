
INSERT INTO public.app_settings (key, value)
VALUES ('preview_sets', jsonb_build_object(
  'website_samples', jsonb_build_array('Confidence','Praying','Words'),
  'trial_readable', jsonb_build_array(
    'Wow! You Are Special',
    'Praying',
    'Character',
    'Words',
    'Leadership',
    'Money',
    'Healthy Eating',
    'Treat You Like a Queen',
    'Pornography',
    'I Love You Anyway'
  ),
  'trial_editable', jsonb_build_array('Wow! You Are Special')
))
ON CONFLICT (key) DO NOTHING;
