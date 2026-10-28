-- Robotics category + 10 new sources (robotics, hardware, China tech) and
-- The Guardian Open Platform as a keyed API source.

alter table public.articles drop constraint articles_category_check;
alter table public.articles add constraint articles_category_check
  check (category in ('AI','Robotics','Dev','Startups','Security','Science','Repos'));

alter table public.sources drop constraint sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('rss','hn','reddit','devto','lobsters','github','guardian'));

insert into public.sources (kind, name, short_name, feed_url, site_url, categories) values
  ('rss', 'The Robot Report', 'TRR',  'https://www.therobotreport.com/feed/',             'https://www.therobotreport.com', '{All,Robotics,AI}'),
  ('rss', 'IEEE Spectrum',    'IEEE', 'https://spectrum.ieee.org/feeds/topic/robotics.rss','https://spectrum.ieee.org',     '{All,Robotics,Science}'),
  ('rss', 'Tech Xplore Robotics', 'TX', 'https://techxplore.com/rss-feed/robotics-news/', 'https://techxplore.com',         '{All,Robotics,Science}'),
  ('rss', 'NVIDIA Blog',      'NV',   'https://blogs.nvidia.com/feed/',                   'https://blogs.nvidia.com',       '{All,AI,Robotics}'),
  ('rss', 'TechNode',         'TN',   'https://technode.com/feed/',                       'https://technode.com',           '{All,AI,Startups}'),
  ('rss', 'SCMP Tech',        'SCMP', 'https://www.scmp.com/rss/36/feed',                 'https://www.scmp.com/tech',      '{All,AI,Startups}'),
  ('rss', 'New Atlas',        'NA',   'https://newatlas.com/index.rss',                   'https://newatlas.com',           '{All,Science,Robotics}'),
  ('rss', 'Hackaday',         'HAD',  'https://hackaday.com/blog/feed/',                  'https://hackaday.com',           '{All,Dev,Robotics}'),
  ('rss', 'MIT News',         'MITN', 'https://news.mit.edu/rss/feed',                    'https://news.mit.edu',           '{All,Science,AI}'),
  ('rss', 'Engadget',         'EG',   'https://www.engadget.com/rss.xml',                 'https://www.engadget.com',       '{All,AI,Dev}'),
  ('guardian', 'The Guardian', 'GDN', null,                                               'https://www.theguardian.com/technology', '{All,AI,Robotics,Science}')
on conflict (name) do nothing;
