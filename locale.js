/* Shared UI localization pass for static and extension-generated copy. */
(function(){
"use strict";
const D={
"Home":{ja:"ホーム",ko:"홈",zh:"首页",ru:"Главная",es:"Inicio",fr:"Accueil"},
"Ranking":{ja:"ランキング",ko:"랭킹",zh:"排行榜",ru:"Рейтинг",es:"Clasificación",fr:"Classement"},
"Genres":{ja:"ジャンル",ko:"장르",zh:"曲风",ru:"Жанры",es:"Géneros",fr:"Genres"},
"For You":{ja:"おすすめ",ko:"추천",zh:"为你推荐",ru:"Для вас",es:"Para ti",fr:"Pour vous"},
"My Hidden Gems":{ja:"お気に入り",ko:"내 숨은 명곡",zh:"我的珍藏",ru:"Избранное",es:"Mis joyas",fr:"Mes pépites"},
"Recommend":{ja:"曲を推薦",ko:"노래 추천",zh:"推荐歌曲",ru:"Рекомендовать",es:"Recomendar",fr:"Recommander"},
"Explore":{ja:"見つける",ko:"둘러보기",zh:"探索",ru:"Обзор",es:"Explorar",fr:"Explorer"},
"Artists":{ja:"アーティスト",ko:"아티스트",zh:"艺人",ru:"Исполнители",es:"Artistas",fr:"Artistes"},
"Playlists":{ja:"プレイリスト",ko:"플레이리스트",zh:"播放列表",ru:"Плейлисты",es:"Listas",fr:"Playlists"},
"J-POP Cup":{ja:"J-POP杯",ko:"J-POP 컵",zh:"J-POP杯",ru:"Кубок J-POP",es:"Copa J-POP",fr:"Coupe J-POP"},
"Feedback":{ja:"目安箱",ko:"의견함",zh:"意见箱",ru:"Обратная связь",es:"Sugerencias",fr:"Suggestions"},
"Daily 5":{ja:"今日の5曲",ko:"오늘의 5곡",zh:"今日5首",ru:"5 треков дня",es:"5 de hoy",fr:"5 du jour"},
"Music Profile":{ja:"音楽プロフィール",ko:"음악 프로필",zh:"音乐档案",ru:"Музыкальный профиль",es:"Perfil musical",fr:"Profil musical"},
"Community":{ja:"コミュニティ",ko:"커뮤니티",zh:"社区",ru:"Сообщество",es:"Comunidad",fr:"Communauté"},
"Weekly":{ja:"週間まとめ",ko:"주간 요약",zh:"每周回顾",ru:"Неделя",es:"Resumen semanal",fr:"Bilan hebdomadaire"},
"Discovery Hub":{ja:"発掘ハブ",ko:"발견 허브",zh:"发现中心",ru:"Центр открытий",es:"Centro de descubrimiento",fr:"Centre de découverte"},
"Global":{ja:"世界へ",ko:"글로벌",zh:"全球",ru:"Мир",es:"Global",fr:"Monde"},
"Account":{ja:"アカウント",ko:"계정",zh:"账户",ru:"Аккаунт",es:"Cuenta",fr:"Compte"},
"How it works":{ja:"仕組み",ko:"이용 방법",zh:"使用方法",ru:"Как это работает",es:"Cómo funciona",fr:"Fonctionnement"},
"Language":{ja:"言語",ko:"언어",zh:"语言",ru:"Язык",es:"Idioma",fr:"Langue"},
"Your next Japanese favorite.":{ja:"次に好きになる、日本の一曲。",ko:"다음에 좋아할 일본 음악.",zh:"你的下一首日本心头好。",ru:"Ваш следующий любимый трек из Японии.",es:"Tu próxima canción japonesa favorita.",fr:"Votre prochain coup de cœur japonais."},
"Discover overlooked Japanese hits, then help the best songs rise.":{ja:"懐かしいヒットから知られざる名曲まで。聴いて、評価して、次の一曲を見つけよう。",ko:"숨은 일본 히트곡을 발견하고 최고의 곡이 떠오르도록 도와주세요.",zh:"发现被低估的日本歌曲，并帮助佳作脱颖而出。",ru:"Открывайте недооценённые японские хиты и помогайте лучшим подняться.",es:"Descubre éxitos japoneses poco conocidos y ayuda a destacar a los mejores.",fr:"Découvrez des titres japonais méconnus et faites monter les meilleurs."},
"How are you listening?":{ja:"どちらとして参加しますか？",ko:"어디에서 듣고 있나요?",zh:"你从哪里收听？",ru:"Откуда вы слушаете?",es:"¿Desde dónde escuchas?",fr:"D’où écoutez-vous ?"},
"I’m listening from Japan":{ja:"日本から参加する",ko:"일본에서 듣고 있어요",zh:"我在日本收听",ru:"Я слушаю из Японии",es:"Escucho desde Japón",fr:"J’écoute depuis le Japon"},
"I’m listening from outside Japan":{ja:"日本国外から参加する",ko:"일본 밖에서 듣고 있어요",zh:"我在日本以外收听",ru:"Я слушаю за пределами Японии",es:"Escucho desde fuera de Japón",fr:"J’écoute hors du Japon"},
"Change audience":{ja:"参加方法を変更",ko:"참여 방식 변경",zh:"更改参与方式",ru:"Изменить режим",es:"Cambiar modo",fr:"Changer de mode"},
"Hidden Gem Index":{ja:"隠れた名曲ランキング",ko:"숨은 명곡 랭킹",zh:"隐藏名曲排行榜",ru:"Рейтинг скрытых жемчужин",es:"Índice de joyas ocultas",fr:"Classement des pépites"},
"Find your sound.":{ja:"好きな音から探そう。",ko:"나만의 사운드를 찾아보세요.",zh:"找到你的声音。",ru:"Найдите своё звучание.",es:"Encuentra tu sonido.",fr:"Trouvez votre son."},
"Songs picked for you":{ja:"あなたに合いそうな曲",ko:"나를 위한 추천곡",zh:"为你挑选的歌曲",ru:"Песни для вас",es:"Canciones para ti",fr:"Titres choisis pour vous"},
"Your saved songs":{ja:"お気に入りの曲",ko:"저장한 노래",zh:"收藏的歌曲",ru:"Сохранённые песни",es:"Canciones guardadas",fr:"Titres enregistrés"},
"Recommend a song to the world.":{ja:"海外の人に聴いてほしい曲を推薦しよう。",ko:"세계에 알리고 싶은 노래를 추천하세요.",zh:"向世界推荐一首歌曲。",ru:"Порекомендуйте песню миру.",es:"Recomienda una canción al mundo.",fr:"Recommandez un titre au monde."},
"Search":{ja:"検索",ko:"검색",zh:"搜索",ru:"Поиск",es:"Buscar",fr:"Rechercher"},
"Save":{ja:"保存",ko:"저장",zh:"保存",ru:"Сохранить",es:"Guardar",fr:"Enregistrer"},
"Loading…":{ja:"読み込み中…",ko:"불러오는 중…",zh:"加载中…",ru:"Загрузка…",es:"Cargando…",fr:"Chargement…"},
"Collecting data":{ja:"集計中",ko:"집계 중",zh:"统计中",ru:"Сбор данных",es:"Recopilando datos",fr:"Collecte en cours"},
"Listen & Rate":{ja:"聴いて評価",ko:"듣고 평가",zh:"试听并评分",ru:"Слушать и оценить",es:"Escuchar y valorar",fr:"Écouter et noter"},
"Privacy":{ja:"プライバシー",ko:"개인정보 보호",zh:"隐私",ru:"Конфиденциальность",es:"Privacidad",fr:"Confidentialité"},
"Community guidelines":{ja:"コミュニティ指針",ko:"커뮤니티 지침",zh:"社区准则",ru:"Правила сообщества",es:"Normas de la comunidad",fr:"Règles de la communauté"},
"Help listeners understand a song":{ja:"曲の魅力を海外の人へ伝えよう",ko:"청취자가 노래를 이해하도록 도와주세요",zh:"帮助听众理解歌曲",ru:"Помогите слушателям понять песню",es:"Ayuda a comprender una canción",fr:"Aidez à comprendre un titre"},
"No songs available.":{ja:"表示できる曲がありません。",ko:"표시할 노래가 없습니다.",zh:"暂无可显示的歌曲。",ru:"Нет доступных песен.",es:"No hay canciones disponibles.",fr:"Aucun titre disponible."},
"Take your discoveries with you":{ja:"見つけた曲を、いつものサービスで聴こう",ko:"발견한 곡을 즐겨 쓰는 서비스에서 들어보세요",zh:"在常用服务中继续收听你的发现",ru:"Слушайте находки в любимом сервисе",es:"Lleva tus descubrimientos contigo",fr:"Emportez vos découvertes"},
"Share your hidden-gem five":{ja:"あなたの隠れた名曲5選を共有",ko:"나만의 숨은 명곡 5곡 공유",zh:"分享你的5首隐藏名曲",ru:"Поделитесь пятёркой скрытых жемчужин",es:"Comparte tus cinco joyas ocultas",fr:"Partagez vos cinq pépites"},
"Generate card":{ja:"カードを作成",ko:"카드 만들기",zh:"生成卡片",ru:"Создать карточку",es:"Crear tarjeta",fr:"Créer la carte"},
"Help J-pop cross borders":{ja:"J-POPが国境を越えるきっかけを作ろう",ko:"J-POP이 국경을 넘도록 도와주세요",zh:"帮助J-POP跨越国界",ru:"Помогите J-pop пересечь границы",es:"Ayuda al J-pop a cruzar fronteras",fr:"Aidez la J-pop à franchir les frontières"},
"Discovery people can trust":{ja:"安心して曲を発見できる仕組み",ko:"신뢰할 수 있는 음악 발견",zh:"值得信赖的音乐发现",ru:"Открытия, которым можно доверять",es:"Descubrimientos de confianza",fr:"Des découvertes fiables"},
"Last 30 days":{ja:"直近30日",ko:"최근 30일",zh:"最近30天",ru:"Последние 30 дней",es:"Últimos 30 días",fr:"30 derniers jours"},
"Visible songs":{ja:"公開曲",ko:"공개 곡",zh:"公开歌曲",ru:"Доступные песни",es:"Canciones visibles",fr:"Titres visibles"},
"Sessions":{ja:"利用回数",ko:"세션",zh:"访问次数",ru:"Сеансы",es:"Sesiones",fr:"Sessions"},
"Quiz finishes":{ja:"診断完了",ko:"테스트 완료",zh:"测试完成",ru:"Тесты завершены",es:"Tests completados",fr:"Tests terminés"},
"Shares":{ja:"共有",ko:"공유",zh:"分享",ru:"Поделились",es:"Compartidos",fr:"Partages"},
"Curators":{ja:"キュレーター",ko:"큐레이터",zh:"策展人",ru:"Кураторы",es:"Curadores",fr:"Curateurs"},
"Languages":{ja:"言語",ko:"언어",zh:"语言",ru:"Языки",es:"Idiomas",fr:"Langues"},
"A reason to listen again":{ja:"また聴きたくなる場所",ko:"다시 듣고 싶은 이유",zh:"再次聆听的理由",ru:"Повод послушать снова",es:"Una razón para volver a escuchar",fr:"Une raison de réécouter"},
"Today's J-pop discovery":{ja:"今日のJ-POP発見",ko:"오늘의 J-POP 발견",zh:"今日J-POP发现",ru:"J-pop открытие дня",es:"Descubrimiento J-pop de hoy",fr:"Découverte J-pop du jour"},
"Your music profile":{ja:"あなたの音楽プロフィール",ko:"나의 음악 프로필",zh:"你的音乐档案",ru:"Ваш музыкальный профиль",es:"Tu perfil musical",fr:"Votre profil musical"}
};
const reverse=new Map();
Object.entries(D).forEach(([en,values])=>{reverse.set(en,en);Object.values(values).forEach(value=>reverse.set(value,en))});
function valueFor(text){const key=reverse.get(text.trim());if(!key)return null;if(interfaceLanguage==='en')return key;return D[key]?.[interfaceLanguage]||key}
function localizeTree(root=document.body){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName))return NodeFilter.FILTER_REJECT;return node.data.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{const before=node.data,spaceStart=before.match(/^\s*/)?.[0]||'',spaceEnd=before.match(/\s*$/)?.[0]||'',translated=valueFor(before.trim());if(translated&&translated!==before.trim())node.data=spaceStart+translated+spaceEnd});document.querySelectorAll('[placeholder],[aria-label]').forEach(el=>['placeholder','aria-label'].forEach(attr=>{if(!el.hasAttribute(attr))return;const next=valueFor(el.getAttribute(attr));if(next)el.setAttribute(attr,next)}))}
const original=setInterfaceLanguage;
setInterfaceLanguage=function(language,persist=true){original(language,persist);queueMicrotask(()=>localizeTree())};
document.addEventListener('DOMContentLoaded',()=>{localizeTree();const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE){const next=valueFor(node.data.trim());if(next)node.data=next}else if(node.nodeType===Node.ELEMENT_NODE)localizeTree(node)})));observer.observe(document.body,{childList:true,subtree:true})});
window.applyFullLocale=localizeTree;
})();
