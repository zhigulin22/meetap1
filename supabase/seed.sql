insert into public.users (id, phone, name, telegram_verified, xp, level, interests, hobbies, facts, avatar_url, last_post_at)
values
('11111111-1111-1111-1111-111111111111', '+79990000001', 'Аня', true, 120, 3, '{дизайн,бег,кофе}', '{йога,кино}', '{Люблю архитектуру,Была в 15 странах,Учу испанский}', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', now()),
('22222222-2222-2222-2222-222222222222', '+79990000002', 'Илья', true, 90, 2, '{стартапы,спорт,нетворк}', '{падел,подкасты}', '{Работаю в продукте,Пью фильтр кофе,Люблю митапы}', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', now()),
('33333333-3333-3333-3333-333333333333', '+79990000003', 'Лиза', true, 70, 2, '{фото,музыка,искусство}', '{фотография,винил}', '{Снимаю на пленку,Хожу на выставки,Люблю утренние прогулки}', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80', now())
on conflict (id) do update set
  name = excluded.name,
  telegram_verified = excluded.telegram_verified,
  interests = excluded.interests,
  last_post_at = excluded.last_post_at;

insert into public.events (id, title, description, outcomes, cover_url, event_date, price, city)
values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'City Brunch Networking', 'Неспешный бранч и знакомства в небольших группах.', '{3 новых контакта,Разбор карьерных целей,Легкий нетворк}', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80', now() + interval '2 day', 0, 'Москва'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Night Art Walk', 'Вечерняя прогулка по галереям с куратором.', '{Новые знакомства,Погружение в искусство,Aftertalk}', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', now() + interval '4 day', 1900, 'Москва'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Founders Friday', 'Камерный формат для предпринимателей и продактов.', '{3 warm-intro,Разбор идей,Практика питча}', 'https://images.unsplash.com/photo-1558403194-611308249627?auto=format&fit=crop&w=1200&q=80', now() + interval '7 day', 2500, 'Москва')
on conflict (id) do nothing;

insert into public.event_members (event_id, user_id)
values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333')
on conflict (event_id, user_id) do nothing;

insert into public.posts (id, user_id, type, caption)
values
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'daily_duo', 'Субботний день с друзьями'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'reel', 'Короткий reel с вечернего ивента')
on conflict (id) do nothing;

insert into public.photos (post_id, user_id, kind, url)
values
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'front', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'back', 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1000&q=80'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'cover', 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4')
on conflict do nothing;
