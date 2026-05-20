-- rollback: DELETE FROM public.nutrients WHERE id IN (아래 리스트 전부);

-- 초기 마이그레이션에서 누락된 영양소들을 public.nutrients 테이블에 추가합니다.
-- refine-ingredients Edge Function의 nutrientDatabase와 동기화합니다.

insert into public.nutrients (id, standard_name, category, aliases, default_unit, risk_level) values
  ('selenium', '셀레늄', '미네랄', array['selenium', 'se', '셀레늄', '셀렌'], 'mcg', 'high'),
  ('ginseng', '홍삼', '허브/추출물', array['ginseng', 'red ginseng', '홍삼', '인삼', '진세노사이드', 'ginsenoside'], 'mg', 'high'),
  ('grapefruit', '자몽 추출물', '허브/추출물', array['grapefruit', '자몽', '자몽추출물'], 'mg', 'high'),
  ('coq10', '코엔자임 Q10', '항산화제', array['coq10', '코엔자임', '코엔자임큐텐', 'ubiquinone', '유비퀴논'], 'mg', 'low'),
  ('probiotics', '유산균', '유익균', array['probiotics', '프로바이오틱스', '유산균', 'lactobacillus'], 'CFU', 'low'),
  ('choline', '콜린', '비타민', array['choline', '콜린'], 'mg', 'medium'),
  ('vitamin_b2', '비타민 B2', '비타민', array['b2', 'riboflavin', '리보플라빈'], 'mg', 'low'),
  ('catechin', '카테킨', '허브/추출물', array['catechin', 'catechins', '카테킨', 'egcg', '녹차추출물', 'green tea extract'], 'mg', 'medium'),
  ('corosolic_acid', '코로솔산', '허브/추출물', array['corosolic acid', '코로솔산', '바나바잎', 'banaba', 'banaba leaf'], 'mg', 'medium'),
  ('lutein', '루테인', '허브/추출물', array['lutein', '루테인', '지아잔틴', 'zeaxanthin'], 'mg', 'medium'),
  ('collagen', '콜라겐', '단백질', array['collagen', '콜라겐', 'hydrolyzed collagen', '가수분해콜라겐'], 'mg', 'low'),
  ('glucosamine', '글루코사민', '허브/추출물', array['glucosamine', '글루코사민'], 'mg', 'medium'),
  ('iodine', '요오드', '미네랄', array['iodine', '요오드', 'iodine'], 'mcg', 'medium'),
  ('folate', '엽산', '비타민', array['folate', 'folic acid', '엽산', '폴산'], 'mcg', 'low'),
  ('niacin', '나이아신', '비타민', array['niacin', 'b3', '나이아신', 'nicotinic acid'], 'mg', 'low'),
  ('biotin', '비오틴', '비타민', array['biotin', 'b7', '비오틴', '비타민h'], 'mcg', 'low'),
  ('pantothenic_acid', '판토텐산', '비타민', array['pantothenic acid', 'b5', '판토텐산'], 'mg', 'low'),
  ('chromium', '크롬', '미네랄', array['chromium', '크롬', 'cr'], 'mcg', 'medium'),
  ('manganese', '망간', '미네랄', array['manganese', '망간', 'mn'], 'mg', 'medium'),
  ('copper', '구리', '미네랄', array['copper', '구리', 'cu'], 'mg', 'medium'),
  ('phosphorus', '인', '미네랄', array['phosphorus', '인', 'p'], 'mg', 'medium'),
  ('potassium', '칼륨', '미네랄', array['potassium', '칼륨', 'k'], 'mg', 'medium'),
  ('sodium', '나트륨', '미네랄', array['sodium', '나트륨', 'na'], 'mg', 'medium'),
  ('ashwagandha', '아슈와간다', '허브/추출물', array['ashwagandha', '아슈와간다', '위타니아'], 'mg', 'medium'),
  ('turmeric', '강황/커큐민', '허브/추출물', array['turmeric', 'curcumin', '강황', '커큐민'], 'mg', 'medium'),
  ('milk_thistle', '밀크씨슬', '허브/추출물', array['milk thistle', 'silymarin', '밀크씨슬', '실리마린'], 'mg', 'medium'),
  ('berberine', '베르베린', '허브/추출물', array['berberine', '베르베린'], 'mg', 'medium'),
  ('spirulina', '스피루리나', '허브/추출물', array['spirulina', '스피루리나'], 'mg', 'medium'),
  ('l_arginine', 'L-아르기닌', '아미노산', array['l-arginine', '아르기닌', 'arginine'], 'mg', 'medium'),
  ('l_theanine', 'L-테아닌', '아미노산', array['l-theanine', '테아닌', 'theanine'], 'mg', 'medium'),
  ('melatonin', '멜라토닌', '호르몬', array['melatonin', '멜라토닌'], 'mg', 'high'),
  ('glutathione', '글루타치온', '항산화제', array['glutathione', '글루타치온', 'gsh'], 'mg', 'medium'),
  ('resveratrol', '레스베라트롤', '항산화제', array['resveratrol', '레스베라트롤'], 'mg', 'medium'),
  ('quercetin', '케르세틴', '항산화제', array['quercetin', '케르세틴'], 'mg', 'medium')
on conflict (id) do update set
  standard_name = excluded.standard_name,
  category = excluded.category,
  aliases = excluded.aliases,
  default_unit = excluded.default_unit,
  risk_level = excluded.risk_level;
