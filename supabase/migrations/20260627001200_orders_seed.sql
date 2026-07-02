insert into public.shipping_zones (code, name, countries, flat_rate_thb, sort)
values
  ('TH',  jsonb_build_object('th','ในประเทศ', 'en','Thailand'),         array['TH'],                          60,  0),
  ('SEA', jsonb_build_object('th','เอเชียตะวันออกเฉียงใต้', 'en','Southeast Asia'), array['MY','SG','ID','VN','PH'], 280, 10),
  ('WW',  jsonb_build_object('th','ทั่วโลก',   'en','Worldwide'),       array['*'],                           650, 20)
on conflict (code) do nothing;
