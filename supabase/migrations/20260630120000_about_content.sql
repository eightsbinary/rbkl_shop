-- Editable About-page content (singleton). One jsonb holding every bilingual
-- field, seeded from the current i18n copy so the page is unchanged until an
-- admin edits it. Public read; owner/dev manage (writes go via service role,
-- consistent with payment_settings / shipping_zones).
create table public.about_content (
  id text primary key default 'singleton',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger about_content_set_updated_at
before update on public.about_content
for each row execute function public.set_updated_at();

alter table public.about_content enable row level security;

create policy "about_content_public_read"
on public.about_content for select to anon, authenticated using (true);

create policy "about_content_owner_dev_all"
on public.about_content for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

grant select on public.about_content to anon, authenticated;

insert into public.about_content (id, content) values ('singleton', $j${"heroTitle":{"en":"Made with care.","th":"ทำด้วยใจ"},"heroBody1":{"en":"rainbykello is a small studio for the things I make and share with my community — designed slowly, in limited runs, and shipped warmly from Thailand.","th":"rainbykello คือสตูดิโอเล็ก ๆ สำหรับสิ่งที่ฉันตั้งใจทำและแบ่งปันกับคอมมูนิตี้ — ออกแบบอย่างค่อยเป็นค่อยไป ผลิตจำนวนจำกัด และจัดส่งด้วยความอบอุ่นจากประเทศไทย"},"heroBody2":{"en":"Everything here starts on stream and ends in your hands. No mass production, no noise — just objects I'd want to keep myself.","th":"ทุกอย่างเริ่มต้นบนสตรีมและจบลงในมือของคุณ ไม่มีการผลิตจำนวนมาก ไม่มีเสียงรบกวน — มีแค่ของที่ฉันเองก็อยากเก็บไว้"},"craftTitle":{"en":"How it's made","th":"ทำอย่างไร"},"craftSubtitle":{"en":"Every drop is considered — from the first sketch to the package on your doorstep.","th":"ทุกคอลเลกชันผ่านการคิดมาอย่างดี — ตั้งแต่ภาพร่างแรกจนถึงพัสดุที่หน้าบ้านคุณ"},"craftCaption":{"en":"Material — chosen by hand","th":"วัสดุ — คัดด้วยมือ"},"card1Title":{"en":"Made to last","th":"ทำมาให้ใช้ได้นาน"},"card1Body":{"en":"Heavyweight fabrics and durable prints, chosen so each piece holds up to everyday wear.","th":"เลือกใช้เนื้อผ้าหนาและงานพิมพ์ที่ทนทาน เพื่อให้ทุกชิ้นอยู่กับคุณได้ในทุกวัน"},"card2Title":{"en":"Small batches","th":"ผลิตจำนวนจำกัด"},"card2Body":{"en":"Limited runs mean tighter quality control and less waste — once a drop sells out, it's gone.","th":"ล็อตเล็กหมายถึงการควบคุมคุณภาพที่ดีกว่าและของเหลือทิ้งที่น้อยลง — เมื่อขายหมดแล้วก็คือหมดเลย"},"inspirationLabel":{"en":"Inspiration","th":"แรงบันดาลใจ"},"inspirationTitle":{"en":"Stream & community","th":"สตรีมและคอมมูนิตี้"},"inspirationBody1":{"en":"The work is shaped by the people who show up — the chat, the regulars, the late-night streams.","th":"งานทุกชิ้นถูกหล่อหลอมจากผู้คนที่แวะมา — แชท ขาประจำ และสตรีมดึก ๆ"},"inspirationBody2":{"en":"Every design is a little artifact of that community: something to carry the feeling of being part of it, offline.","th":"ทุกดีไซน์คือชิ้นส่วนเล็ก ๆ ของคอมมูนิตี้นั้น สิ่งที่พาความรู้สึกของการได้เป็นส่วนหนึ่งออกมาสู่โลกจริง"}}$j$::jsonb)
on conflict (id) do nothing;
