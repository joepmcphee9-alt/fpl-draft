insert into squad_players (entry_id, fpl_player_id)
values
  ('2aec2aa8-688a-4720-ae00-1330e74b98ef', 140),
  ('2aec2aa8-688a-4720-ae00-1330e74b98ef', 141),
  ('2aec2aa8-688a-4720-ae00-1330e74b98ef', 560),
  ('cb6a69a5-b4b2-44be-a919-73022d991fbc', 615),
  ('44dd6443-2b1f-4bf5-80da-145344283390', 140),
  ('44dd6443-2b1f-4bf5-80da-145344283390', 141),
  ('44dd6443-2b1f-4bf5-80da-145344283390', 560),
  ('ef8718b2-f55a-43f4-9662-bb0097ae72ee', 615),
  ('87ba7e2f-258a-45eb-8730-ee62436ca5a7', 615),
  ('e4e35a1d-bef3-45c2-a463-c414de3b45a8', 140),
  ('e4e35a1d-bef3-45c2-a463-c414de3b45a8', 141),
  ('e4e35a1d-bef3-45c2-a463-c414de3b45a8', 560)
on conflict (entry_id, fpl_player_id) do nothing;
