const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh-CN', name: '中文（简体）' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
];

const CODES = LANGUAGES.map(language => language.code);
const MESSAGES = {
  "Princípios": ["Principles","Princípios","Principios","Principes","Grundsätze","Principi","Principes","Принципы","原则","原則","원칙","İlkeler","المبادئ","सिद्धांत"],
  "Amostra curta": ["Small sample","Amostra curta","Muestra pequeña","Petit échantillon","Kleine Stichprobe","Campione ridotto","Kleine steekproef","Малая выборка","样本较少","少数例","작은 표본","Küçük örneklem","عينة صغيرة","छोटा नमूना"],
  "Consistente": ["Consistent","Consistente","Constante","Régulier","Konstant","Costante","Consistent","Стабильно","稳定","安定","일관됨","Tutarlı","متسق","सुसंगत"],
  "A rever": ["Needs review","A rever","Por revisar","À revoir","Überprüfen","Da rivedere","Te bekijken","К разбору","待复盘","要検討","검토 필요","İncelenmeli","يحتاج مراجعة","समीक्षा करें"],
  "Misto": ["Mixed","Misto","Mixto","Variable","Gemischt","Misto","Gemengd","Смешанно","表现不一","まちまち","혼합","Karışık","متفاوت","मिश्रित"],
  "Voltar à partida": ["Return to game","Voltar à partida","Volver a la partida","Revenir à la partie","Zur Partie","Torna alla partita","Terug naar partij","Вернуться к партии","返回对局","対局に戻る","대국으로 돌아가기","Oyuna dön","العودة للمباراة","खेल पर लौटें"],
  "Segurança do rei": ["King safety","Segurança do rei","Seguridad del rey","Sécurité du roi","Königssicherheit","Sicurezza del re","Koningsveiligheid","Безопасность короля","王的安全","キングの安全","왕의 안전","Şah güvenliği","أمان الملك","राजा की सुरक्षा"],
  "Desenvolvimento": ["Development","Desenvolvimento","Desarrollo","Développement","Entwicklung","Sviluppo","Ontwikkeling","Развитие","出子","展開","전개","Gelişim","التطوير","विकास"],
  "Centro": ["Center","Centro","Centro","Centre","Zentrum","Centro","Centrum","Центр","中心","中央","중앙","Merkez","الوسط","केंद्र"],
  "Coluna aberta": ["Open file","Coluna aberta","Columna abierta","Colonne ouverte","Offene Linie","Colonna aperta","Open lijn","Открытая линия","开放线","オープンファイル","열린 파일","Açık hat","عمود مفتوح","खुली फ़ाइल"],
  "Atividade das peças": ["Piece activity","Atividade das peças","Actividad de las piezas","Activité des pièces","Figurenaktivität","Attività dei pezzi","Stukactiviteit","Активность фигур","子力活动","駒の活動性","기물 활동","Taş etkinliği","نشاط القطع","मोहरे की सक्रियता"],
  "Atividade do rei": ["King activity","Atividade do rei","Actividad del rey","Activité du roi","Königsaktivität","Attività del re","Koningsactiviteit","Активность короля","王的活动","キングの活動","왕의 활동","Şah etkinliği","نشاط الملك","राजा की सक्रियता"],
  "Estrutura de peões": ["Pawn structure","Estrutura de peões","Estructura de peones","Structure de pions","Bauernstruktur","Struttura pedonale","Pionnenstructuur","Пешечная структура","兵形","ポーン構造","폰 구조","Piyon yapısı","بنية البيادق","प्यादों की संरचना"],
  "Peão passado": ["Passed pawn","Peão passado","Peón pasado","Pion passé","Freibauer","Pedone passato","Vrijpion","Проходная пешка","通路兵","パスポーン","패스드 폰","Geçer piyon","بيدق سالك","पारित प्यादा"],
  "Madeira": ["Wood","Madeira","Madera","Bois","Holz","Legno","Hout","Дерево","木质","木製","나무","Ahşap","خشب","लकड़ी"],
  "Som das peças": ["Piece sounds","Som das peças","Sonidos de piezas","Sons des pièces","Figurenklänge","Suoni dei pezzi","Stukgeluiden","Звуки фигур","棋子音效","駒音","기물 소리","Taş sesleri","أصوات القطع","मोहरे की ध्वनियाँ"],
  "Legenda": ["Legend","Legenda","Leyenda","Légende","Legende","Legenda","Legenda","Условные обозначения","图例","凡例","범례","Gösterge","مفتاح الرسم","संकेत"],
  "Sem posição relevante": ["No relevant position","Sem posição relevante"],
  "Imprecisões ou erros": ["Inaccuracies or errors","Imprecisões ou erros"],
  "Revisão incompleta": ["Review incomplete","Revisão incompleta"],
  "Fora da amostra": ["Outside the sample","Fora da amostra"],
  "Ritmo sem calibração": ["Uncalibrated time control","Ritmo sem calibração"],
  "Método e validação": ["Method and validation","Método e validação"],
  "Faixa de referência Lichess. Uma partida tem alta incerteza.": ["Lichess reference range. A single game carries substantial uncertainty.","Faixa de referência Lichess. Uma partida tem alta incerteza."],
  "Nenhum momento destacado na análise disponível.": ["No key moment in the available analysis.","Nenhum momento destacado na análise disponível."],

  'Análise': ['Analysis','Análise','Análisis','Analyse','Analyse','Analisi','Analyse','Анализ','分析','解析','분석','Analiz','تحليل','विश्लेषण'],
  'Puzzles': ['Puzzles','Puzzles','Problemas','Problèmes','Aufgaben','Problemi','Puzzels','Задачи','谜题','パズル','퍼즐','Bulmacalar','الألغاز','पहेलियाँ'],
  'Arquivo': ['Library','Arquivo','Biblioteca','Bibliothèque','Bibliothek','Archivio','Bibliotheek','Библиотека','资料库','ライブラリ','보관함','Arşiv','المكتبة','लाइब्रेरी'],
  'Ajustes': ['Settings','Ajustes','Ajustes','Paramètres','Einstellungen','Impostazioni','Instellingen','Настройки','设置','設定','설정','Ayarlar','الإعدادات','सेटिंग्स'],
  'Créditos': ['Credits','Créditos','Créditos','Crédits','Mitwirkende','Crediti','Credits','Авторы','致谢','クレジット','크레딧','Katkıda bulunanlar','الاعتمادات','श्रेय'],
  'Análise de partida': ['Game analysis','Análise de partida','Análisis de partida','Analyse de partie','Partieanalyse','Analisi della partita','Partijanalyse','Анализ партии','棋局分析','棋譜解析','대국 분석','Oyun analizi','تحليل المباراة','खेल विश्लेषण'],
  'Motor local': ['Local engine','Motor local','Motor local','Moteur local','Lokale Engine','Motore locale','Lokale engine','Локальный движок','本地引擎','ローカルエンジン','로컬 엔진','Yerel motor','محرك محلي','स्थानीय इंजन'],
  'Tabuleiro': ['Chessboard','Tabuleiro','Tablero','Échiquier','Schachbrett','Scacchiera','Schaakbord','Шахматная доска','棋盘','チェス盤','체스판','Satranç tahtası','رقعة الشطرنج','शतरंज बोर्ड'],
  'Som do tabuleiro': ['Board sounds','Sons do tabuleiro','Sonidos del tablero','Sons de l’échiquier','Brettsounds','Suoni della scacchiera','Bordgeluiden','Звуки доски','棋盘音效','盤面サウンド','보드 사운드','Tahta sesleri','أصوات الرقعة','बोर्ड ध्वनियाँ'],
  'Tela cheia': ['Fullscreen','Tela cheia','Pantalla completa','Plein écran','Vollbild','Schermo intero','Volledig scherm','Полный экран','全屏','全画面','전체 화면','Tam ekran','ملء الشاشة','पूर्ण स्क्रीन'],
  'Xeque-mate': ['Checkmate','Xeque-mate','Jaque mate','Échec et mat','Schachmatt','Scacco matto','Schaakmat','Мат','将死','チェックメイト','체크메이트','Şah mat','كش مات','शह और मात'],
  'Navegação pelos lances': ['Move navigation','Navegação pelos lances','Navegación de jugadas','Navigation des coups','Zugnavigation','Navigazione mosse','Zetnavigatie','Навигация по ходам','棋步导航','手のナビゲーション','수 이동','Hamle gezintisi','التنقل بين النقلات','चाल नेविगेशन'],
  'Primeiro lance (Home)': ['First move (Home)','Primeiro lance (Home)','Primera jugada (Home)','Premier coup (Home)','Erster Zug (Home)','Prima mossa (Home)','Eerste zet (Home)','Первый ход (Home)','第一步 (Home)','最初の手 (Home)','첫 수 (Home)','İlk hamle (Home)','النقلة الأولى (Home)','पहली चाल (Home)'],
  'Voltar (←)': ['Back (←)','Voltar (←)','Atrás (←)','Précédent (←)','Zurück (←)','Indietro (←)','Terug (←)','Назад (←)','后退 (←)','戻る (←)','뒤로 (←)','Geri (←)','رجوع (←)','पीछे (←)'],
  'Reprodução automática (Espaço)': ['Autoplay (Space)','Reprodução automática (Espaço)','Reproducción automática (Espacio)','Lecture automatique (Espace)','Automatische Wiedergabe (Leertaste)','Riproduzione automatica (Spazio)','Automatisch afspelen (Spatie)','Автовоспроизведение (Пробел)','自动播放（空格）','自動再生（Space）','자동 재생 (Space)','Otomatik oynat (Boşluk)','تشغيل تلقائي (مسافة)','ऑटोप्ले (Space)'],
  'Avançar (→)': ['Forward (→)','Avançar (→)','Adelante (→)','Suivant (→)','Weiter (→)','Avanti (→)','Vooruit (→)','Вперёд (→)','前进 (→)','進む (→)','앞으로 (→)','İleri (→)','تقدم (→)','आगे (→)'],
  'Último lance (End)': ['Last move (End)','Último lance (End)','Última jugada (End)','Dernier coup (End)','Letzter Zug (End)','Ultima mossa (End)','Laatste zet (End)','Последний ход (End)','最后一步 (End)','最後の手 (End)','마지막 수 (End)','Son hamle (End)','النقلة الأخيرة (End)','अंतिम चाल (End)'],
  'Girar tabuleiro (F)': ['Flip board (F)','Girar tabuleiro (F)','Girar tablero (F)','Retourner l’échiquier (F)','Brett drehen (F)','Ruota scacchiera (F)','Bord draaien (F)','Перевернуть доску (F)','翻转棋盘 (F)','盤面を反転 (F)','보드 뒤집기 (F)','Tahtayı çevir (F)','قلب الرقعة (F)','बोर्ड पलटें (F)'],
  'Central de análise': ['Analysis workspace','Central de análise','Centro de análisis','Espace d’analyse','Analysebereich','Area di analisi','Analysecentrum','Рабочая область анализа','分析工作区','解析ワークスペース','분석 작업 공간','Analiz alanı','مساحة التحليل','विश्लेषण कार्यक्षेत्र'],
  'Compartilhar ou exportar': ['Share or export','Compartilhar ou exportar','Compartir o exportar','Partager ou exporter','Teilen oder exportieren','Condividi o esporta','Delen of exporteren','Поделиться или экспортировать','分享或导出','共有またはエクスポート','공유 또는 내보내기','Paylaş veya dışa aktar','مشاركة أو تصدير','साझा करें या निर्यात करें'],
  'Painéis': ['Panels','Painéis','Paneles','Panneaux','Bereiche','Pannelli','Panelen','Панели','面板','パネル','패널','Paneller','اللوحات','पैनल'],
  'Importar': ['Import','Importar','Importar','Importer','Importieren','Importa','Importeren','Импорт','导入','インポート','가져오기','İçe aktar','استيراد','आयात'],
  'Revisão': ['Review','Revisão','Revisión','Revue','Überprüfung','Revisione','Review','Обзор','复盘','レビュー','복기','İnceleme','مراجعة','समीक्षा'],
  'Variantes': ['Lines','Variantes','Variantes','Variantes','Varianten','Varianti','Varianten','Варианты','变化图','変化','수순','Varyantlar','التحليلات','विकल्प'],
  'Importar partida': ['Import a game','Importar partida','Importar partida','Importer une partie','Partie importieren','Importa partita','Partij importeren','Импортировать партию','导入棋局','棋譜をインポート','대국 가져오기','Oyun içe aktar','استيراد مباراة','खेल आयात करें'],
  'Cole uma partida, carregue um arquivo ou busque um jogador.': ['Paste a game, upload a file, or look up a player.','Cole uma partida, carregue um arquivo ou busque um jogador.','Pega una partida, sube un archivo o busca un jugador.','Collez une partie, importez un fichier ou recherchez un joueur.','Füge eine Partie ein, lade eine Datei hoch oder suche einen Spieler.','Incolla una partita, carica un file o cerca un giocatore.','Plak een partij, upload een bestand of zoek een speler.','Вставьте партию, загрузите файл или найдите игрока.','粘贴棋局、上传文件或搜索棋手。','棋譜を貼り付けるか、ファイルをアップロードするか、プレイヤーを検索してください。','대국을 붙여넣거나 파일을 업로드하거나 플레이어를 검색하세요.','Bir oyun yapıştırın, dosya yükleyin veya oyuncu arayın.','الصق مباراة أو حمّل ملفًا أو ابحث عن لاعب.','खेल पेस्ट करें, फ़ाइल अपलोड करें या खिलाड़ी खोजें।'],
  'Fonte da partida': ['Game source','Fonte da partida','Origen de la partida','Source de la partie','Partiequelle','Origine della partita','Partijbron','Источник партии','棋局来源','棋譜のソース','대국 출처','Oyun kaynağı','مصدر المباراة','खेल स्रोत'],
  'PGN da partida': ['Game PGN','PGN da partida','PGN de la partida','PGN de la partie','Partie-PGN','PGN della partita','Partij-PGN','PGN партии','棋局 PGN','棋譜 PGN','대국 PGN','Oyun PGN','PGN المباراة','खेल PGN'],
  'Abrir arquivo PGN': ['Open PGN file','Abrir arquivo PGN','Abrir archivo PGN','Ouvrir un fichier PGN','PGN-Datei öffnen','Apri file PGN','PGN-bestand openen','Открыть файл PGN','打开 PGN 文件','PGN ファイルを開く','PGN 파일 열기','PGN dosyası aç','فتح ملف PGN','PGN फ़ाइल खोलें'],
  'Analisar partida': ['Analyze game','Analisar partida','Analizar partida','Analyser la partie','Partie analysieren','Analizza partita','Partij analyseren','Анализировать партию','分析棋局','棋譜を分析','대국 분석','Oyunu analiz et','تحليل المباراة','खेल का विश्लेषण करें'],
  'Explorar': ['Explore','Explorar','Explorar','Explorer','Entdecken','Esplora','Ontdekken','Исследовать','探索','探索','둘러보기','Keşfet','استكشف','एक्सप्लोर करें'],
  'Partida de exemplo': ['Sample game','Partida de exemplo','Partida de ejemplo','Partie exemple','Beispielpartie','Partita di esempio','Voorbeeldpartij','Пример партии','示例棋局','サンプル棋譜','예제 대국','Örnek oyun','مباراة تجريبية','उदाहरण खेल'],
  'Mate do Pastor': ['Scholar’s Mate','Mate do Pastor','Mate del pastor','Mat du berger','Schäfermatt','Matto del barbiere','Herdersmat','Детский мат','学者杀','初心者殺し','초보자 메이트','Aptal matı','مات الراعي','चरवाहे का मात'],
  'Analisar o tabuleiro atual': ['Analyze current position','Analisar o tabuleiro atual','Analizar la posición actual','Analyser la position actuelle','Aktuelle Stellung analysieren','Analizza la posizione corrente','Huidige stelling analyseren','Анализировать текущую позицию','分析当前局面','現在の局面を分析','현재 포지션 분석','Mevcut konumu analiz et','تحليل الوضع الحالي','वर्तमान स्थिति का विश्लेषण करें'],
  'Revisão da partida': ['Game review','Revisão da partida','Revisión de la partida','Revue de la partie','Partieüberprüfung','Revisione della partita','Partijreview','Обзор партии','棋局复盘','棋譜レビュー','대국 복기','Oyun incelemesi','مراجعة المباراة','खेल समीक्षा'],
  'Revisar': ['Review','Revisar','Revisar','Revoir','Überprüfen','Rivedi','Reviewen','Обзор','复盘','レビュー','복기','İncele','مراجعة','समीक्षा'],
  'Equilíbrio da partida': ['Game balance','Equilíbrio da partida','Equilibrio de la partida','Équilibre de la partie','Partiebilanz','Equilibrio della partita','Partijbalans','Баланс партии','棋局走势','形勢バランス','대국 균형','Oyun dengesi','توازن المباراة','खेल संतुलन'],
  'Gráfico da avaliação ao longo da partida. Os marcadores coloridos identificam lances classificados e podem ser selecionados para navegar até eles.': ['Evaluation chart across the game. Colored markers identify classified moves and can be selected to navigate to them.','Gráfico da avaliação ao longo da partida. Os marcadores coloridos identificam lances classificados e podem ser selecionados para navegar até eles.','Gráfico de evaluación de la partida. Los marcadores de colores identifican jugadas clasificadas y se pueden seleccionar para navegar hasta ellas.','Graphique d’évaluation de la partie. Les marqueurs colorés identifient les coups classés et permettent d’y accéder.','Bewertungsdiagramm der Partie. Farbige Markierungen kennzeichnen bewertete Züge und ermöglichen die Navigation zu ihnen.','Grafico della valutazione della partita. Gli indicatori colorati identificano le mosse classificate e consentono di raggiungerle.','Evaluatiegrafiek van de partij. Gekleurde markeringen geven geclassificeerde zetten aan en zijn selecteerbaar.','График оценки партии. Цветные маркеры обозначают классифицированные ходы и позволяют перейти к ним.','整局评估图。彩色标记表示已分类的着法，点击即可跳转。','対局全体の評価グラフ。色付きマーカーは分類された手を示し、選択すると移動できます。','대국 전체의 평가 그래프입니다. 색상 표시는 분류된 수를 나타내며 선택하여 이동할 수 있습니다.','Oyun boyunca değerlendirme grafiği. Renkli işaretler sınıflandırılmış hamleleri gösterir ve seçilerek o hamleye gidilebilir.','مخطط تقييم المباراة. تشير العلامات الملونة إلى النقلات المصنفة ويمكن تحديدها للانتقال إليها.','पूरे खेल का मूल्यांकन चार्ट। रंगीन मार्कर वर्गीकृत चालें दिखाते हैं और चुनकर उन तक पहुँचा जा सकता है।'],
  'Legenda das classificações': ['Move classification legend','Legenda das classificações','Leyenda de clasificaciones','Légende des classifications','Legende der Zugbewertungen','Legenda delle classificazioni','Legenda met zetclassificaties','Легенда классификаций','着法分类图例','手の分類凡例','수 분류 범례','Hamle sınıflandırma açıklaması','مفتاح تصنيفات النقلات','चाल वर्गीकरण संकेत'],
  'Brilhante': ['Brilliant','Brilhante','Brillante','Brillant','Glänzend','Brillante','Briljant','Блестящий','妙手','妙手','묘수','Parlak','رائع','शानदार'],
  "Desempenho estimado com curvas de aproximadamente 16 mil partidas do Chess.com. É uma estimativa por partida, não o rating real do jogador.": ["The performance estimate uses accuracy curves from approximately 16,000 Chess.com games. It is a single-game estimate, not the player's actual rating.","Desempenho estimado com curvas de aproximadamente 16 mil partidas do Chess.com. É uma estimativa por partida, não o rating real do jogador.","El rendimiento estimado usa curvas de aproximadamente 16.000 partidas de Chess.com. Es una estimación por partida, no el rating real del jugador.","La performance estimée utilise des courbes issues d’environ 16 000 parties Chess.com. C’est une estimation sur une partie, pas le classement réel du joueur.","Die Leistungsschätzung nutzt Genauigkeitskurven aus etwa 16.000 Chess.com-Partien. Sie ist eine Schätzung für eine einzelne Partie, nicht die tatsächliche Wertung.","La prestazione stimata usa curve basate su circa 16.000 partite Chess.com. È una stima per una partita, non il rating reale del giocatore.","De geschatte prestatie gebruikt nauwkeurigheidscurves uit ongeveer 16.000 Chess.com-partijen. Het is een schatting voor één partij, niet de echte rating van de speler.","Оценка результата основана на кривых точности примерно 16 000 партий Chess.com. Это оценка одной партии, а не реальный рейтинг игрока.","表现估算基于约 16,000 场 Chess.com 对局的准确率曲线。它是单局估算值，并非玩家的真实等级分。","推定パフォーマンスは約16,000局のChess.comの精度曲線に基づきます。1局の推定値であり、実際のレーティングではありません。","추정 실력은 약 16,000개의 Chess.com 게임 정확도 곡선을 사용합니다. 한 경기의 추정치이며 실제 레이팅은 아닙니다.","Tahmini performans, yaklaşık 16.000 Chess.com oyunundan elde edilen doğruluk eğrilerini kullanır. Tek oyunluk bir tahmindir, oyuncunun gerçek ratingi değildir.","تستخدم تقديرات الأداء منحنيات الدقة المستمدة من نحو 16,000 مباراة على Chess.com. إنها تقدير لمباراة واحدة وليست التصنيف الفعلي للاعب.","प्रदर्शन का अनुमान लगभग 16,000 Chess.com खेलों के सटीकता वक्रों पर आधारित है। यह एक खेल का अनुमान है, खिलाड़ी की वास्तविक रेटिंग नहीं।"],
  "Intervalo aproximado: ": ["Estimated range: ","Intervalo aproximado: ","Intervalo aproximado: ","Intervalle approximatif : ","Ungefährer Bereich: ","Intervallo approssimativo: ","Geschat bereik: ","Примерный диапазон: ","估计范围：","推定範囲：","예상 범위: ","Tahmini aralık: ","النطاق التقريبي: ","अनुमानित सीमा: "],
  "Erro mediano de referência em uma partida: ±": ["Median single-game reference error: ±","Erro mediano de referência em uma partida: ±","Error mediano de referencia por partida: ±","Erreur médiane de référence sur une partie : ±","Medianer Referenzfehler pro Partie: ±","Errore mediano di riferimento per partita: ±","Mediane referentiefout per partij: ±","Медианная ошибка за одну партию: ±","单局参考中位误差：±","1局あたりの参考中央値誤差：±","단일 게임 기준 중앙 오차: ±","Tek oyun referans medyan hatası: ±","متوسط الخطأ المرجعي في مباراة واحدة: ±","एकल खेल संदर्भ माध्यिका त्रुटि: ±"],
  " pontos de rating.": [" rating points."," pontos de rating."," puntos de rating."," points de classement."," Wertungspunkte."," punti rating."," ratingpunten."," пунктов рейтинга.","等级分。","レーティングポイント。","레이팅 포인트."," rating puanı."," نقطة تصنيف."," रेटिंग अंक।"],
  "Desempenho estimado com curvas de aproximadamente 16 mil observações de jogadores em partidas do Chess.com. É uma estimativa por partida, não o rating real do jogador.": ["The estimate uses performance curves from approximately 16,000 player-game observations on Chess.com. It is a single-game estimate, not the player's actual rating.","Desempenho estimado com curvas de aproximadamente 16 mil observações de jogadores em partidas do Chess.com. É uma estimativa por partida, não o rating real do jogador.","El rendimiento estimado usa curvas de unas 16.000 observaciones de jugadores en partidas de Chess.com. Es una estimación por partida, no el rating real del jugador.","La performance estimée utilise des courbes issues d’environ 16 000 observations de joueurs dans des parties Chess.com. C’est une estimation sur une partie, pas le classement réel du joueur.","Die Leistungsschätzung nutzt Genauigkeitskurven aus etwa 16.000 Spieler-Partie-Beobachtungen auf Chess.com. Sie ist eine Schätzung für eine einzelne Partie, nicht die tatsächliche Wertung.","La prestazione stimata usa curve basate su circa 16.000 osservazioni di giocatori in partite Chess.com. È una stima per una partita, non il rating reale del giocatore.","De geschatte prestatie gebruikt nauwkeurigheidscurves uit ongeveer 16.000 speler-partijwaarnemingen op Chess.com. Het is een schatting voor één partij, niet de echte rating van de speler.","Оценка результата основана на кривых точности примерно 16 000 наблюдений за игроками в партиях Chess.com. Это оценка одной партии, а не реальный рейтинг игрока.","表现估算基于约 16,000 条 Chess.com 对局中的玩家数据。它是单局估算值，并非玩家的真实等级分。","推定パフォーマンスはChess.comの約16,000件のプレイヤー対局データに基づきます。1局の推定値であり、実際のレーティングではありません。","추정 실력은 약 16,000개의 Chess.com 플레이어 게임 관측치로 만든 정확도 곡선을 사용합니다. 한 경기의 추정치이며 실제 레이팅은 아닙니다.","Tahmini performans, Chess.com oyunlarındaki yaklaşık 16.000 oyuncu-gösteriminden elde edilen doğruluk eğrilerini kullanır. Tek oyunluk bir tahmindir, gerçek rating değildir.","تستخدم تقديرات الأداء منحنيات الدقة المستمدة من نحو 16,000 مشاهدة للاعبين في مباريات Chess.com. إنها تقدير لمباراة واحدة وليست التصنيف الفعلي للاعب.","प्रदर्शन का अनुमान लगभग 16,000 Chess.com खिलाड़ी-खेल अवलोकनों से बने सटीकता वक्रों पर आधारित है। यह एक खेल का अनुमान है, वास्तविक रेटिंग नहीं।"],
  "Erro absoluto mediano de referência em uma partida: ": ["Median absolute reference error for one game: ","Erro absoluto mediano de referência em uma partida: ","Error absoluto mediano de referencia por partida: ","Erreur absolue médiane de référence sur une partie : ","Medianer absoluter Referenzfehler pro Partie: ","Errore assoluto mediano di riferimento per partita: ","Mediane absolute referentiefout per partij: ","Медианная абсолютная ошибка за одну партию: ","单局参考绝对中位误差：","1局あたりの参考絶対中央値誤差：","단일 게임 기준 중앙 절대 오차: ","Tek oyun referans medyan mutlak hatası: ","الخطأ المطلق الوسيط المرجعي لمباراة واحدة: ","एकल खेल संदर्भ माध्यिका निरपेक्ष त्रुटि: "],
  'Ótimo': ['Great','Ótimo','Genial','Excellent','Großartig','Ottimo','Geweldig','Отлично','好棋','好手','훌륭한 수','Harika','رائع','शानदार'],
  'Oportunidade perdida': ['Missed opportunity','Oportunidade perdida','Oportunidad perdida','Occasion manquée','Verpasste Chance','Occasione mancata','Gemiste kans','Упущенный шанс','错失良机','逃したチャンス','놓친 기회','Kaçırılan fırsat','فرصة ضائعة','छूटा हुआ अवसर'],
  'Imprecisão': ['Inaccuracy','Imprecisão','Imprecisión','Imprécision','Ungenauigkeit','Imprecisione','Onnauwkeurigheid','Неточность','欠佳','疑問手','부정확','Hatalı','عدم دقة','अशुद्धि'],
  'Erro': ['Mistake','Erro','Error','Erreur','Fehler','Errore','Fout','Ошибка','失误','悪手','실수','Hata','خطأ','गलती'],
  'Erro grave': ['Blunder','Erro grave','Error grave','Gaffe','Patzer','Gravissimo errore','Blunder','Грубая ошибка','严重失误','大悪手','큰 실수','Büyük hata','خطأ فادح','बड़ी गलती'],
  'Teoria': ['Theory','Teoria','Teoría','Théorie','Theorie','Teoria','Theorie','Теория','理论','定跡','이론','Teori','نظرية','सिद्धांत'],
  'Início': ['Start','Início','Inicio','Début','Start','Inizio','Begin','Начало','开始','開始','시작','Başlangıç','البداية','शुरुआत'],
  'Fim': ['End','Fim','Fin','Fin','Ende','Fine','Einde','Конец','结束','終了','끝','Bitiş','النهاية','अंत'],
  'Momentos importantes': ['Key moments','Momentos importantes','Momentos clave','Moments clés','Wichtige Momente','Momenti chiave','Belangrijke momenten','Ключевые моменты','关键时刻','重要な局面','주요 순간','Önemli anlar','لحظات مهمة','महत्वपूर्ण क्षण'],
  ' lances': [' moves',' lances',' jugadas',' coups',' Züge',' mosse',' zetten',' ходов',' 步',' 手',' 수',' hamle',' نقلات',' चालें'],
  ' lance': [' move',' lance',' jugada',' coup',' Zug',' mossa',' zet',' ход',' 步',' 手',' 수',' hamle',' نقلة',' चाल'],
  'Precisão por jogador': ['Accuracy by player','Precisão por jogador','Precisión por jugador','Précision par joueur','Genauigkeit pro Spieler','Precisione per giocatore','Nauwkeurigheid per speler','Точность игроков','双方准确率','プレイヤー別精度','플레이어별 정확도','Oyuncuya göre doğruluk','الدقة لكل لاعب','खिलाड़ी के अनुसार सटीकता'],
  'Brancas': ['White','Brancas','Blancas','Blancs','Weiß','Bianco','Wit','Белые','白方','白','백','Beyaz','الأبيض','सफेद'],
  'Pretas': ['Black','Pretas','Negras','Noirs','Schwarz','Nero','Zwart','Чёрные','黑方','黒','흑','Siyah','الأسود','काला'],
  'Rating estimado por jogador': ['Estimated rating by player','Rating estimado por jogador','Rating estimado por jugador','Classement estimé par joueur','Geschätzte Wertung pro Spieler','Rating stimato per giocatore','Geschatte rating per speler','Оценка рейтинга игроков','玩家估算等级分','プレイヤー推定レーティング','플레이어 추정 레이팅','Oyuncuya göre tahmini rating','التصنيف التقديري لكل لاعب','खिलाड़ी का अनुमानित रेटिंग'],
  'Os ratings estimados aparecem após a análise de pelo menos cinco lances de cada jogador.': ['Estimated ratings appear after at least five moves per player have been analyzed.','Os ratings estimados aparecem após a análise de pelo menos cinco lances de cada jogador.','Los ratings estimados aparecen tras analizar al menos cinco jugadas de cada jugador.','Les classements estimés apparaissent après l’analyse d’au moins cinq coups par joueur.','Geschätzte Wertungen erscheinen nach der Analyse von mindestens fünf Zügen pro Spieler.','I rating stimati vengono mostrati dopo aver analizzato almeno cinque mosse per giocatore.','Geschatte ratings verschijnen nadat minstens vijf zetten per speler zijn geanalyseerd.','Оценка рейтинга появляется после анализа не менее пяти ходов каждого игрока.','分析双方至少五步后才会显示估算等级分。','各プレイヤーの手を5手以上分析すると推定レーティングが表示されます。','플레이어당 최소 5수 분석 후 추정 레이팅이 표시됩니다.','Her oyuncu için en az beş hamle analiz edildikten sonra tahmini rating gösterilir.','تظهر التصنيفات التقديرية بعد تحليل خمس نقلات على الأقل لكل لاعب.','प्रत्येक खिलाड़ी की कम से कम पाँच चालों का विश्लेषण होने के बाद अनुमानित रेटिंग दिखाई जाती है।'],
  'Estimativa aproximada baseada nas decisões analisadas pelo Stockfish. Não representa o rating real ou oficial de nenhum jogador.': ['An approximation based on decisions evaluated by Stockfish. It is not any player’s actual or official rating.','Estimativa aproximada baseada nas decisões analisadas pelo Stockfish. Não representa o rating real ou oficial de nenhum jogador.','Estimación aproximada basada en las decisiones evaluadas por Stockfish. No representa el rating real u oficial de ningún jugador.','Estimation approximative basée sur les décisions évaluées par Stockfish. Elle ne représente pas le classement réel ou officiel d’un joueur.','Näherungswert auf Basis der von Stockfish bewerteten Entscheidungen. Er entspricht keiner tatsächlichen oder offiziellen Spielerwertung.','Stima approssimativa basata sulle decisioni valutate da Stockfish. Non rappresenta il rating reale o ufficiale di alcun giocatore.','Benadering op basis van door Stockfish beoordeelde beslissingen. Dit is geen echte of officiële rating van een speler.','Приблизительная оценка на основе решений, проанализированных Stockfish. Она не является реальным или официальным рейтингом игрока.','该估算基于 Stockfish 对棋手决策的评估，不代表任何玩家的真实或官方等级分。','Stockfish が評価した指し手に基づく概算です。実際または公式のレーティングではありません。','Stockfish가 평가한 선택을 바탕으로 한 추정치이며 실제 또는 공식 레이팅이 아닙니다.','Stockfish tarafından değerlendirilen kararlara dayalı yaklaşık bir değerdir. Gerçek veya resmî oyuncu ratingi değildir.','تقدير تقريبي يعتمد على القرارات التي حللها Stockfish، ولا يمثل التصنيف الحقيقي أو الرسمي لأي لاعب.','Stockfish द्वारा विश्लेषित निर्णयों पर आधारित अनुमान है। यह किसी खिलाड़ी की वास्तविक या आधिकारिक रेटिंग नहीं है।'],
  'Classificação': ['Classification','Classificação','Clasificación','Classification','Bewertung','Classificazione','Classificatie','Классификация','分类','分類','분류','Sınıflandırma','التصنيف','वर्गीकरण'],
  'Precisão estimada e classificações calculadas a partir da avaliação do motor.': ['Estimated accuracy and classifications are calculated from engine evaluations.','Precisão estimada e classificações calculadas a partir da avaliação do motor.','La precisión y las clasificaciones estimadas se calculan a partir de las evaluaciones del motor.','La précision estimée et les classifications sont calculées à partir des évaluations du moteur.','Geschätzte Genauigkeit und Bewertungen werden aus den Engine-Analysen berechnet.','Precisione stimata e classificazioni sono calcolate dalle valutazioni del motore.','Geschatte nauwkeurigheid en classificaties worden berekend op basis van engine-evaluaties.','Точность и классификации рассчитываются на основе оценок движка.','估算准确率和分类根据引擎评估计算。','推定精度と分類はエンジンの評価に基づいて計算されます。','추정 정확도와 분류는 엔진 평가를 기반으로 계산됩니다.','Tahmini doğruluk ve sınıflandırmalar motor değerlendirmelerinden hesaplanır.','يتم حساب الدقة والتصنيفات التقديرية بناءً على تقييمات المحرك.','अनुमानित सटीकता और वर्गीकरण इंजन के मूल्यांकन से गणना किए जाते हैं।'],
  'Análise da posição': ['Position analysis','Análise da posição','Análisis de posición','Analyse de la position','Stellungsanalyse','Analisi della posizione','Positieanalyse','Анализ позиции','局面分析','局面分析','포지션 분석','Konum analizi','تحليل الوضع','स्थिति विश्लेषण'],
  'Motor aguardando análise': ['Engine ready','Motor aguardando análise','Motor en espera','Moteur en attente','Engine wartet auf Analyse','Motore in attesa','Engine wacht op analyse','Движок ожидает анализа','引擎等待分析','エンジン待機中','엔진 대기 중','Motor analiz bekliyor','المحرك بانتظار التحليل','इंजन विश्लेषण की प्रतीक्षा में'],
  'Puzzles da partida': ['Game puzzles','Puzzles da partida','Problemas de la partida','Problèmes de la partie','Partieaufgaben','Problemi della partita','Partijpuzzels','Задачи из партии','棋局谜题','棋譜パズル','대국 퍼즐','Oyun bulmacaları','ألغاز المباراة','खेल पहेलियाँ'],
  'Histórico de lances': ['Move history','Histórico de lances','Historial de jugadas','Historique des coups','Zugverlauf','Cronologia mosse','Zetgeschiedenis','История ходов','着法记录','棋譜','수 기록','Hamle geçmişi','سجل النقلات','चाल इतिहास'],
  'Configurações': ['Settings','Configurações','Configuración','Paramètres','Einstellungen','Impostazioni','Instellingen','Настройки','设置','設定','설정','Ayarlar','الإعدادات','सेटिंग्स'],
  'Fechar': ['Close','Fechar','Cerrar','Fermer','Schließen','Chiudi','Sluiten','Закрыть','关闭','閉じる','닫기','Kapat','إغلاق','बंद करें'],
  'Modo do Stockfish': ['Stockfish mode','Modo do Stockfish','Modo de Stockfish','Mode Stockfish','Stockfish-Modus','Modalità Stockfish','Stockfish-modus','Режим Stockfish','Stockfish 模式','Stockfish モード','Stockfish 모드','Stockfish modu','وضع Stockfish','Stockfish मोड'],
  'Lite (recomendado)': ['Lite (recommended)','Lite (recomendado)','Lite (recomendado)','Lite (recommandé)','Lite (empfohlen)','Lite (consigliato)','Lite (aanbevolen)','Lite (рекомендуется)','Lite（推荐）','Lite（推奨）','Lite (권장)','Lite (önerilen)','Lite (موصى به)','Lite (अनुशंसित)'],
  'Completo · mais forte (~95 MB)': ['Full · stronger (~95 MB)','Completo · mais forte (~95 MB)','Completo · más potente (~95 MB)','Complet · plus puissant (~95 Mo)','Vollversion · stärker (~95 MB)','Completo · più potente (~95 MB)','Volledig · krachtiger (~95 MB)','Полный · мощнее (~95 МБ)','完整 · 更强（约 95 MB）','フル · より強力（約95 MB）','전체 · 더 강력함 (약 95MB)','Tam · daha güçlü (~95 MB)','كامل · أقوى (~95 ميجابايت)','पूर्ण · अधिक शक्तिशाली (~95 MB)'],
  'O Lite é carregado por padrão. O Completo continua disponível para análises mais exigentes e baixa cerca de 95 MB.': ['Lite loads by default. Full remains available for demanding analysis and downloads about 95 MB.','O Lite é carregado por padrão. O Completo continua disponível para análises mais exigentes e baixa cerca de 95 MB.','Lite se carga de forma predeterminada. Completo sigue disponible para análisis exigentes y descarga unos 95 MB.','Lite est chargé par défaut. La version complète reste disponible pour les analyses exigeantes et télécharge environ 95 Mo.','Lite wird standardmäßig geladen. Full bleibt für anspruchsvollere Analysen verfügbar und lädt etwa 95 MB herunter.','Lite viene caricato per impostazione predefinita. Completo resta disponibile per analisi più impegnative e scarica circa 95 MB.','Lite wordt standaard geladen. Full blijft beschikbaar voor zwaardere analyses en downloadt ongeveer 95 MB.','По умолчанию загружается Lite. Полная версия доступна для сложного анализа и загружает около 95 МБ.','默认加载 Lite。完整版本可用于更深入的分析，下载量约为 95 MB。','デフォルトでは Lite が読み込まれます。より高度な分析にはフル版を利用でき、約95 MBをダウンロードします。','기본적으로 Lite가 로드됩니다. 더 까다로운 분석에는 Full을 사용할 수 있으며 약 95MB를 다운로드합니다.','Varsayılan olarak Lite yüklenir. Daha zorlu analizler için Full seçeneği kullanılabilir ve yaklaşık 95 MB indirir.','يتم تحميل Lite افتراضيًا. يظل الإصدار الكامل متاحًا للتحليلات المتقدمة ويتطلب تنزيل نحو 95 ميجابايت.','डिफ़ॉल्ट रूप से Lite लोड होता है। अधिक कठिन विश्लेषण के लिए Full उपलब्ध है और लगभग 95 MB डाउनलोड करता है।'],
  'Profundidade da revisão': ['Review depth','Profundidade da revisão','Profundidad de revisión','Profondeur de révision','Analysetiefe','Profondità revisione','Reviewdiepte','Глубина анализа','复盘深度','レビュー深度','복기 깊이','İnceleme derinliği','عمق المراجعة','समीक्षा गहराई'],
  'Profundidade das variantes': ['Variation depth','Profundidade das variantes','Profundidad de variantes','Profondeur des variantes','Varianten-Tiefe','Profondità varianti','Variantdiepte','Глубина вариантов','变化深度','変化の深さ','수순 깊이','Varyant derinliği','عمق التحليلات','विकल्प गहराई'],
  'Linhas simultâneas': ['Parallel lines','Linhas simultâneas','Líneas simultáneas','Lignes simultanées','Gleichzeitige Varianten','Linee simultanee','Gelijktijdige lijnen','Одновременные линии','同时变化图','同時ライン','동시 라인','Eşzamanlı çizgiler','الخطوط المتزامنة','एक साथ लाइनें'],
  'Conjunto de peças': ['Piece set','Conjunto de peças','Conjunto de piezas','Jeu de pièces','Figurensatz','Set di pezzi','Stukkenset','Набор фигур','棋子样式','駒セット','기물 세트','Taş seti','مجموعة القطع','मोहरों का सेट'],
  'Clássicas · Cburnett': ['Classic · Cburnett','Clássicas · Cburnett','Clásicas · Cburnett','Classique · Cburnett','Klassisch · Cburnett','Classico · Cburnett','Klassiek · Cburnett','Классика · Cburnett','经典 · Cburnett','クラシック · Cburnett','클래식 · Cburnett','Klasik · Cburnett','كلاسيكي · Cburnett','क्लासिक · Cburnett'],
  'Ateliê': ['Atelier','Ateliê','Atelier','Atelier','Atelier','Atelier','Atelier','Ателье','工坊','アトリエ','아틀리에','Atölye','أتيليه','एटेलियर'],
  'Sons do tabuleiro': ['Board sounds','Sons do tabuleiro','Sonidos del tablero','Sons de l’échiquier','Brettsounds','Suoni della scacchiera','Bordgeluiden','Звуки доски','棋盘音效','盤面サウンド','보드 사운드','Tahta sesleri','أصوات الرقعة','बोर्ड ध्वनियाँ'],
  'Volume dos sons': ['Sound volume','Volume dos sons','Volumen de sonido','Volume sonore','Lautstärke','Volume audio','Geluidsvolume','Громкость звука','音量','音量','볼륨','Ses seviyesi','مستوى الصوت','ध्वनि वॉल्यूम'],
  'Velocidade das animações': ['Animation speed','Velocidade das animações','Velocidad de animación','Vitesse des animations','Animationsgeschwindigkeit','Velocità animazioni','Animatiesnelheid','Скорость анимации','动画速度','アニメーション速度','애니메이션 속도','Animasyon hızı','سرعة الحركة','एनीमेशन गति'],
  'Natural': ['Natural','Natural','Natural','Naturelle','Natürlich','Naturale','Natuurlijk','Естественная','自然','自然','자연스러움','Doğal','طبيعي','प्राकृतिक'],
  'Lenta': ['Slow','Lenta','Lenta','Lente','Langsam','Lenta','Langzaam','Медленно','慢','遅い','느림','Yavaş','بطيء','धीमा'],
  'Normal': ['Normal','Normal','Normal','Normale','Normal','Normale','Normaal','Обычная','正常','標準','보통','Normal','عادي','सामान्य'],
  'Rápida': ['Fast','Rápida','Rápida','Rapide','Schnell','Veloce','Snel','Быстро','快','速い','빠름','Hızlı','سريع','तेज़'],
  'Animação de xeque-mate': ['Checkmate animation','Animação de xeque-mate','Animación de jaque mate','Animation d’échec et mat','Schachmatt-Animation','Animazione scacco matto','Schaakmat-animatie','Анимация мата','将死动画','チェックメイト演出','체크메이트 애니메이션','Şah mat animasyonu','رسوم كش مات','शह-मात एनीमेशन'],
  'Mostrar melhor lance': ['Show best move','Mostrar melhor lance','Mostrar mejor jugada','Afficher le meilleur coup','Besten Zug anzeigen','Mostra la mossa migliore','Beste zet tonen','Показать лучший ход','显示最佳着法','最善手を表示','최선 수 표시','En iyi hamleyi göster','إظهار أفضل نقلة','सर्वश्रेष्ठ चाल दिखाएँ'],
  'Mostrar coordenadas': ['Show coordinates','Mostrar coordenadas','Mostrar coordenadas','Afficher les coordonnées','Koordinaten anzeigen','Mostra coordinate','Coördinaten tonen','Показать координаты','显示坐标','座標を表示','좌표 표시','Koordinatları göster','إظهار الإحداثيات','निर्देशांक दिखाएँ'],
  'Arquivo local': ['Local library','Arquivo local','Biblioteca local','Bibliothèque locale','Lokale Bibliothek','Archivio locale','Lokale bibliotheek','Локальная библиотека','本地资料库','ローカルライブラリ','로컬 보관함','Yerel arşiv','المكتبة المحلية','स्थानीय लाइब्रेरी'],
  'Copiar link da partida': ['Copy game link','Copiar link da partida','Copiar enlace de la partida','Copier le lien de la partie','Partielink kopieren','Copia link partita','Partijlink kopiëren','Скопировать ссылку на партию','复制棋局链接','棋譜リンクをコピー','대국 링크 복사','Oyun bağlantısını kopyala','نسخ رابط المباراة','खेल लिंक कॉपी करें'],
  'Copiar FEN atual': ['Copy current FEN','Copiar FEN atual','Copiar FEN actual','Copier le FEN actuel','Aktuelle FEN kopieren','Copia FEN corrente','Huidige FEN kopiëren','Скопировать текущий FEN','复制当前 FEN','現在のFENをコピー','현재 FEN 복사','Mevcut FEN’i kopyala','نسخ FEN الحالي','वर्तमान FEN कॉपी करें'],
  'Copiar PGN': ['Copy PGN','Copiar PGN','Copiar PGN','Copier PGN','PGN kopieren','Copia PGN','PGN kopiëren','Скопировать PGN','复制 PGN','PGNをコピー','PGN 복사','PGN’yi kopyala','نسخ PGN','PGN कॉपी करें'],
  'Baixar PGN': ['Download PGN','Baixar PGN','Descargar PGN','Télécharger PGN','PGN herunterladen','Scarica PGN','PGN downloaden','Скачать PGN','下载 PGN','PGNをダウンロード','PGN 다운로드','PGN indir','تنزيل PGN','PGN डाउनलोड करें'],
  'Salvar no arquivo local': ['Save to local library','Salvar no arquivo local','Guardar en la biblioteca local','Enregistrer dans la bibliothèque locale','In lokaler Bibliothek speichern','Salva nell’archivio locale','Opslaan in lokale bibliotheek','Сохранить в локальную библиотеку','保存到本地资料库','ローカルライブラリに保存','로컬 보관함에 저장','Yerel arşive kaydet','حفظ في المكتبة المحلية','स्थानीय लाइब्रेरी में सहेजें'],
  'Promover peão': ['Promote pawn','Promover peão','Coronar peón','Promotion du pion','Bauernumwandlung','Promozione del pedone','Pion promoveren','Превращение пешки','兵升变','ポーンの昇格','폰 승격','Piyonu terfi ettir','ترقية البيدق','प्यादे को बढ़ावा दें'],
  'Trocar idioma': ['Change language','Trocar idioma','Cambiar idioma','Changer de langue','Sprache ändern','Cambia lingua','Taal wijzigen','Сменить язык','更改语言','言語を変更','언어 변경','Dili değiştir','تغيير اللغة','भाषा बदलें'],
  'Escolha seu idioma': ['Choose your language','Escolha seu idioma','Elige tu idioma','Choisissez votre langue','Sprache auswählen','Scegli la lingua','Kies je taal','Выберите язык','选择语言','言語を選択','언어 선택','Dilinizi seçin','اختر لغتك','अपनी भाषा चुनें'],
  'Boas-vindas ao Move by Move': ['Welcome to Move by Move','Boas-vindas ao Move by Move','Te damos la bienvenida a Move by Move','Bienvenue sur Move by Move','Willkommen bei Move by Move','Benvenuto su Move by Move','Welkom bij Move by Move','Добро пожаловать в Move by Move','欢迎使用 Move by Move','Move by Move へようこそ','Move by Move에 오신 것을 환영합니다','Move by Move’a hoş geldiniz','مرحبًا بك في Move by Move','Move by Move में आपका स्वागत है'],
  'Escolha o idioma da interface antes de começar. Você poderá alterá-lo a qualquer momento.': ['Choose your interface language before getting started. You can change it at any time.','Escolha o idioma da interface antes de começar. Você poderá alterá-lo a qualquer momento.','Elige el idioma de la interfaz antes de comenzar. Podrás cambiarlo en cualquier momento.','Choisissez la langue de l’interface avant de commencer. Vous pourrez la modifier à tout moment.','Wähle vor dem Start die Sprache der Oberfläche. Du kannst sie jederzeit ändern.','Scegli la lingua dell’interfaccia prima di iniziare. Potrai cambiarla in qualsiasi momento.','Kies de interfacetaal voordat je begint. Je kunt deze op elk moment wijzigen.','Выберите язык интерфейса перед началом. Его можно изменить в любой момент.','开始前请选择界面语言。之后随时可以更改。','開始する前に表示言語を選択してください。いつでも変更できます。','시작하기 전에 인터페이스 언어를 선택하세요. 언제든지 변경할 수 있습니다.','Başlamadan önce arayüz dilini seçin. Dili istediğiniz zaman değiştirebilirsiniz.','اختر لغة الواجهة قبل البدء. يمكنك تغييرها في أي وقت.','शुरू करने से पहले इंटरफ़ेस भाषा चुनें। आप इसे कभी भी बदल सकते हैं।'],
  'Continue to analysis': ['Continue to analysis','Continuar para análise','Continuar al análisis','Continuer vers l’analyse','Weiter zur Analyse','Continua all’analisi','Doorgaan naar analyse','Перейти к анализу','进入分析','解析へ進む','분석으로 이동','Analize devam et','متابعة إلى التحليل','विश्लेषण पर जाएँ'],
  'You can change your language from the top navigation at any time.': ['You can change your language from the top navigation at any time.','Você pode mudar o idioma pela navegação superior a qualquer momento.','Puedes cambiar el idioma desde la navegación superior en cualquier momento.','Vous pouvez changer de langue depuis la navigation supérieure à tout moment.','Du kannst die Sprache jederzeit über die obere Navigation ändern.','Puoi cambiare lingua in qualsiasi momento dalla navigazione superiore.','Je kunt de taal op elk moment wijzigen via de bovenste navigatie.','Язык можно изменить в верхней панели навигации в любое время.','你可以随时通过顶部导航更改语言。','上部ナビゲーションからいつでも言語を変更できます。','상단 메뉴에서 언제든지 언어를 변경할 수 있습니다.','Dili istediğiniz zaman üst gezinme menüsünden değiştirebilirsiniz.','يمكنك تغيير اللغة من شريط التنقل العلوي في أي وقت.','आप ऊपर के नेविगेशन से कभी भी भाषा बदल सकते हैं।'],
  'Não foi possível carregar as regras do xadrez. Verifique a conexão e recarregue.': ['Could not load the chess rules. Check your connection and reload.','Não foi possível carregar as regras do xadrez. Verifique a conexão e recarregue.','No se pudieron cargar las reglas del ajedrez. Comprueba tu conexión y recarga.','Impossible de charger les règles des échecs. Vérifiez votre connexion et rechargez.','Die Schachregeln konnten nicht geladen werden. Prüfe die Verbindung und lade neu.','Impossibile caricare le regole degli scacchi. Controlla la connessione e ricarica.','De schaakregels konden niet worden geladen. Controleer je verbinding en laad opnieuw.','Не удалось загрузить правила шахмат. Проверьте подключение и перезагрузите страницу.','无法加载国际象棋规则。请检查网络连接并刷新。','チェスのルールを読み込めませんでした。接続を確認して再読み込みしてください。','체스 규칙을 불러오지 못했습니다. 연결을 확인하고 새로고침하세요.','Satranç kuralları yüklenemedi. Bağlantınızı kontrol edip yeniden yükleyin.','تعذر تحميل قواعد الشطرنج. تحقق من الاتصال وأعد التحميل.','शतरंज के नियम लोड नहीं हो सके। कनेक्शन जाँचें और रीफ़्रेश करें।'],
  'O PGN precisa conter lances ou uma posição inicial.': ['The PGN must contain moves or a starting position.','O PGN precisa conter lances ou uma posição inicial.','El PGN debe contener jugadas o una posición inicial.','Le PGN doit contenir des coups ou une position de départ.','Das PGN muss Züge oder eine Ausgangsstellung enthalten.','Il PGN deve contenere mosse o una posizione iniziale.','De PGN moet zetten of een beginstelling bevatten.','PGN должен содержать ходы или начальную позицию.','PGN 必须包含着法或起始局面。','PGNには手順または開始局面が必要です。','PGN에는 수순 또는 시작 포지션이 있어야 합니다.','PGN hamleler veya başlangıç konumu içermelidir.','يجب أن يحتوي PGN على نقلات أو وضعية بداية.','PGN में चालें या प्रारंभिक स्थिति होनी चाहिए।'],
  'Posição importada': ['Imported position','Posição importada','Posición importada','Position importée','Importierte Stellung','Posizione importata','Geïmporteerde positie','Импортированная позиция','已导入局面','インポートした局面','가져온 포지션','İçe aktarılan konum','وضعية مستوردة','आयात की गई स्थिति'],
  'Posição inicial': ['Starting position','Posição inicial','Posición inicial','Position de départ','Ausgangsstellung','Posizione iniziale','Beginstelling','Начальная позиция','初始局面','初期局面','시작 포지션','Başlangıç konumu','الوضعية الأولية','प्रारंभिक स्थिति'],
  'Carregue ou jogue uma partida.': ['Load or play a game.','Carregue ou jogue uma partida.','Carga o juega una partida.','Chargez ou jouez une partie.','Lade oder spiele eine Partie.','Carica o gioca una partita.','Laad of speel een partij.','Загрузите партию или сыграйте её.','载入或进行一盘棋。','棋譜を読み込むか対局してください。','대국을 불러오거나 플레이하세요.','Bir oyun yükleyin veya oynayın.','حمّل مباراة أو العب مباراة.','एक खेल लोड करें या खेलें।'],
  'Jogue no tabuleiro ou importe uma partida.': ['Play on the board or import a game.','Jogue no tabuleiro ou importe uma partida.','Juega en el tablero o importa una partida.','Jouez sur l’échiquier ou importez une partie.','Spiele auf dem Brett oder importiere eine Partie.','Gioca sulla scacchiera o importa una partita.','Speel op het bord of importeer een partij.','Сделайте ход на доске или импортируйте партию.','在棋盘上走棋或导入棋局。','盤面で指すか棋譜をインポートしてください。','보드에서 두거나 대국을 가져오세요.','Tahtada oynayın veya bir oyun içe aktarın.','العب على الرقعة أو استورد مباراة.','बोर्ड पर खेलें या कोई खेल आयात करें।'],
  'Empate': ['Draw','Empate','Tablas','Nulle','Remis','Patta','Remise','Ничья','和棋','引き分け','무승부','Beraberlik','تعادل','ड्रॉ'],
  'Sem avaliação': ['No evaluation','Sem avaliação','Sin evaluación','Aucune évaluation','Keine Bewertung','Nessuna valutazione','Geen evaluatie','Нет оценки','暂无评估','評価なし','평가 없음','Değerlendirme yok','لا يوجد تقييم','कोई मूल्यांकन नहीं'],
  'Os momentos importantes aparecerão aqui depois que a revisão da partida for concluída.': ['Key moments will appear here after the game review is complete.','Os momentos importantes aparecerão aqui depois que a revisão da partida for concluída.','Los momentos clave aparecerán aquí cuando termine la revisión de la partida.','Les moments clés apparaîtront ici une fois l’analyse de la partie terminée.','Wichtige Momente erscheinen hier, sobald die Partieanalyse abgeschlossen ist.','I momenti chiave appariranno qui al termine della revisione della partita.','Belangrijke momenten verschijnen hier zodra de partijreview is voltooid.','Ключевые моменты появятся здесь после завершения анализа партии.','棋局复盘完成后，关键时刻会显示在这里。','棋譜のレビューが完了すると、重要な局面がここに表示されます。','대국 복기가 완료되면 주요 순간이 여기에 표시됩니다.','Oyun incelemesi tamamlandığında önemli anlar burada görünür.','ستظهر اللحظات المهمة هنا بعد اكتمال مراجعة المباراة.','खेल समीक्षा पूरी होने के बाद मुख्य क्षण यहाँ दिखाई देंगे।'],
  ' lances analisados; são necessários pelo menos 5.': [' moves analyzed; at least 5 are required.',' lances analisados; são necessários pelo menos 5.',' jugadas analizadas; se necesitan al menos 5.',' coups analysés ; 5 au minimum sont nécessaires.',' Züge analysiert; mindestens 5 sind erforderlich.',' mosse analizzate; ne servono almeno 5.',' zetten geanalyseerd; minstens 5 vereist.',' ходов проанализировано; требуется не менее 5.',' 步已分析；至少需要 5 步。',' 手を分析済み。最低5手必要です。',' 수 분석됨; 최소 5수가 필요합니다.',' hamle analiz edildi; en az 5 gerekli.',' نقلة تم تحليلها؛ يلزم 5 على الأقل.',' चालों का विश्लेषण; कम से कम 5 आवश्यक हैं।'],
  'Análise da variante editada': ['Edited variation analysis','Análise da variante editada','Análisis de la variante editada','Analyse de la variante modifiée','Analyse der bearbeiteten Variante','Analisi della variante modificata','Analyse van de bewerkte variant','Анализ изменённого варианта','编辑变例分析','編集した変化の解析','수정한 수순 분석','Düzenlenen varyant analizi','تحليل التفرع المعدّل','संपादित विकल्प विश्लेषण'],
  'Aguardando a avaliação do Stockfish para esta nova posição…': ['Waiting for Stockfish to evaluate this new position…','Aguardando a avaliação do Stockfish para esta nova posição…','Esperando la evaluación de Stockfish para esta nueva posición…','En attente de l’évaluation de cette nouvelle position par Stockfish…','Warte auf die Stockfish-Bewertung dieser neuen Stellung…','In attesa della valutazione di Stockfish per questa nuova posizione…','Wachten op de Stockfish-evaluatie van deze nieuwe positie…','Ожидание оценки Stockfish для новой позиции…','正在等待 Stockfish 评估这个新局面…','この新しい局面の Stockfish 評価を待っています…','새 포지션에 대한 Stockfish 평가를 기다리는 중…','Stockfish’in bu yeni konumu değerlendirmesi bekleniyor…','بانتظار تقييم Stockfish لهذه الوضعية الجديدة…','इस नई स्थिति के लिए Stockfish मूल्यांकन की प्रतीक्षा है…'],
  'Posição equilibrada · ': ['Balanced position · ','Posição equilibrada · ','Posición equilibrada · ','Position équilibrée · ','Ausgeglichene Stellung · ','Posizione equilibrata · ','Gelijke stelling · ','Равная позиция · ','均势局面 · ','互角の局面 · ','균형 잡힌 포지션 · ','Dengeli konum · ','وضعية متوازنة · ','संतुलित स्थिति · '],
  'Melhor linha': ['Best line','Melhor linha','Mejor línea','Meilleure ligne','Beste Variante','Migliore linea','Beste lijn','Лучшая линия','最佳变化','最善手順','최선 수순','En iyi çizgi','أفضل خط','सर्वश्रेष्ठ लाइन'],
  'O motor ainda não encontrou uma continuação completa.': ['The engine has not found a complete continuation yet.','O motor ainda não encontrou uma continuação completa.','El motor aún no ha encontrado una continuación completa.','Le moteur n’a pas encore trouvé de continuation complète.','Die Engine hat noch keine vollständige Fortsetzung gefunden.','Il motore non ha ancora trovato una continuazione completa.','De engine heeft nog geen volledige voortzetting gevonden.','Движок пока не нашёл полного продолжения.','引擎尚未找到完整续着。','エンジンはまだ完全な継続手順を見つけていません。','엔진이 아직 완전한 후속 수순을 찾지 못했습니다.','Motor henüz tam bir devam yolu bulamadı.','لم يعثر المحرك بعد على متابعة كاملة.','इंजन को अभी तक पूरा continuation नहीं मिला।'],
  'Último lance do adversário: ': ['Opponent’s previous move: ','Último lance do adversário: ','Última jugada del rival: ','Dernier coup adverse : ','Letzter Zug des Gegners: ','Ultima mossa dell’avversario: ','Vorige zet van de tegenstander: ','Предыдущий ход соперника: ','对手上一步：','相手の直前の手：','상대의 직전 수: ','Rakibin önceki hamlesi: ','نقلة الخصم السابقة: ','प्रतिद्वंद्वी की पिछली चाल: '],
  'Posição inicial da partida.': ['Game starting position.','Posição inicial da partida.','Posición inicial de la partida.','Position initiale de la partie.','Ausgangsstellung der Partie.','Posizione iniziale della partita.','Beginstelling van de partij.','Начальная позиция партии.','棋局起始局面。','対局の開始局面。','대국 시작 포지션.','Oyunun başlangıç konumu.','الوضعية الابتدائية للمباراة.','खेल की शुरुआती स्थिति।'],
  'Voltar ao início': ['Go to start','Voltar ao início','Ir al inicio','Revenir au début','Zum Anfang','Vai all’inizio','Naar begin','В начало','回到开头','最初に戻る','처음으로','Başa dön','العودة إلى البداية','शुरुआत पर जाएँ'],
  'Voltar um lance': ['Go back one move','Voltar um lance','Retroceder una jugada','Reculer d’un coup','Einen Zug zurück','Indietro di una mossa','Eén zet terug','На ход назад','后退一步','1手戻る','한 수 뒤로','Bir hamle geri','الرجوع نقلة واحدة','एक चाल पीछे जाएँ'],
  'Avançar um lance': ['Advance one move','Avançar um lance','Avanzar una jugada','Avancer d’un coup','Einen Zug vor','Avanti di una mossa','Eén zet vooruit','На ход вперёд','前进一步','1手進む','한 수 앞으로','Bir hamle ileri','التقدم نقلة واحدة','एक चाल आगे जाएँ'],
  'Posição ': ['Position ','Posição ','Posición ','Position ','Stellung ','Posizione ','Positie ','Позиция ','局面 ','局面 ','포지션 ','Konum ','الوضعية ','स्थिति '],
  'Revise a partida livremente. Avance até a posição final para resolver o puzzle.': ['Review the game freely. Move to the final position to solve the puzzle.','Revise a partida livremente. Avance até a posição final para resolver o puzzle.','Revisa la partida libremente. Avanza hasta la posición final para resolver el problema.','Revoyez librement la partie. Avancez jusqu’à la position finale pour résoudre le problème.','Analysiere die Partie frei. Gehe zur Endstellung, um die Aufgabe zu lösen.','Rivedi liberamente la partita. Avanza fino alla posizione finale per risolvere il problema.','Bekijk de partij vrij. Ga naar de eindpositie om de puzzel op te lossen.','Свободно просматривайте партию. Перейдите к последней позиции, чтобы решить задачу.','可以自由复盘棋局。前进到最后一个局面来解题。','自由に棋譜を確認できます。最後の局面まで進んでパズルを解いてください。','대국을 자유롭게 검토하세요. 마지막 포지션까지 이동해 퍼즐을 푸세요.','Oyunu özgürce inceleyin. Bulmacayı çözmek için son konuma ilerleyin.','راجع المباراة بحرية. تقدّم إلى الوضعية الأخيرة لحل اللغز.','खेल को स्वतंत्र रूप से देखें। पहेली हल करने के लिए अंतिम स्थिति तक जाएँ।'],
  'Você ficou sem vidas': ['Out of lives','Você ficou sem vidas','Te quedaste sin vidas','Vous n’avez plus de vies','Keine Leben mehr','Hai esaurito le vite','Geen levens meer','Жизни закончились','生命值耗尽','ライフがなくなりました','기회가 모두 소진되었습니다','Canınız kalmadı','نفدت المحاولات','आपके जीवन समाप्त हो गए'],
  'Melhor continuação': ['Best continuation','Melhor continuação','Mejor continuación','Meilleure continuation','Beste Fortsetzung','Migliore continuazione','Beste voortzetting','Лучшее продолжение','最佳续着','最善の継続手順','최선의 후속 수순','En iyi devam','أفضل متابعة','सर्वश्रेष्ठ अगली चाल'],
  'Próximo puzzle': ['Next puzzle','Próximo puzzle','Siguiente problema','Problème suivant','Nächste Aufgabe','Problema successivo','Volgende puzzel','Следующая задача','下一道谜题','次のパズル','다음 퍼즐','Sonraki bulmaca','اللغز التالي','अगली पहेली'],
  'Carregue uma partida e faça a revisão para gerar puzzles a partir dos erros.': ['Load a game and review it to generate puzzles from mistakes.','Carregue uma partida e faça a revisão para gerar puzzles a partir dos erros.','Carga una partida y revísala para generar problemas a partir de los errores.','Chargez une partie et analysez-la pour générer des problèmes à partir des erreurs.','Lade eine Partie und analysiere sie, um Aufgaben aus Fehlern zu erstellen.','Carica e rivedi una partita per generare problemi dagli errori.','Laad en analyseer een partij om puzzels uit fouten te maken.','Загрузите и проанализируйте партию, чтобы создать задачи из ошибок.','导入并复盘棋局，根据失误生成谜题。','棋譜を読み込んでレビューすると、ミスからパズルを作成できます。','대국을 불러와 복기하면 실수에서 퍼즐을 만들 수 있습니다.','Hatalardan bulmaca oluşturmak için bir oyun yükleyip inceleyin.','حمّل مباراة وراجعها لإنشاء ألغاز من الأخطاء.','गलतियों से पहेलियाँ बनाने के लिए खेल लोड करें और समीक्षा करें।'],
  'Escolha uma posição. Você tem três vidas por puzzle.': ['Choose a position. You have three lives per puzzle.','Escolha uma posição. Você tem três vidas por puzzle.','Elige una posición. Tienes tres vidas por problema.','Choisissez une position. Vous avez trois vies par problème.','Wähle eine Stellung. Du hast drei Leben pro Aufgabe.','Scegli una posizione. Hai tre vite per problema.','Kies een positie. Je hebt drie levens per puzzel.','Выберите позицию. У вас три попытки на задачу.','选择一个局面。每道谜题有三次机会。','局面を選択してください。各パズルでライフは3つです。','포지션을 선택하세요. 퍼즐마다 기회가 세 번 주어집니다.','Bir konum seçin. Her bulmaca için üç canınız var.','اختر وضعية. لديك ثلاث محاولات لكل لغز.','एक स्थिति चुनें। हर पहेली के लिए तीन जीवन हैं।'],
  'As melhores continuações aparecem aqui.': ['Best continuations appear here.','As melhores continuações aparecem aqui.','Las mejores continuaciones aparecen aquí.','Les meilleures continuations apparaîtront ici.','Die besten Fortsetzungen erscheinen hier.','Le migliori continuazioni appariranno qui.','De beste voortzettingen verschijnen hier.','Лучшие продолжения появятся здесь.','最佳续着会显示在这里。','最善の継続手順がここに表示されます。','최선의 후속 수순이 여기에 표시됩니다.','En iyi devam yolları burada görünür.','ستظهر أفضل المتابعات هنا.','सर्वश्रेष्ठ अगली चालें यहाँ दिखाई देंगी।'],
  'Análise pausada.': ['Analysis paused.','Análise pausada.','Análisis pausado.','Analyse en pause.','Analyse pausiert.','Analisi in pausa.','Analyse gepauzeerd.','Анализ приостановлен.','分析已暂停。','解析を一時停止しました。','분석이 일시 중지되었습니다.','Analiz duraklatıldı.','تم إيقاف التحليل مؤقتًا.','विश्लेषण रुका हुआ है।'],
  'Fim das três vidas. A solução está no tabuleiro.': ['No lives left. The solution is on the board.','Fim das três vidas. A solução está no tabuleiro.','Se acabaron las vidas. La solución está en el tablero.','Plus de vies. La solution est sur l’échiquier.','Keine Leben mehr. Die Lösung steht auf dem Brett.','Vite esaurite. La soluzione è sulla scacchiera.','Geen levens meer. De oplossing staat op het bord.','Попытки закончились. Решение показано на доске.','三次机会已用完。答案已显示在棋盘上。','ライフがなくなりました。解答は盤面に表示されています。','기회가 모두 소진되었습니다. 해답이 보드에 있습니다.','Canınız bitti. Çözüm tahtada.','انتهت المحاولات. الحل ظاهر على الرقعة.','तीनों जीवन समाप्त। समाधान बोर्ड पर है।'],
  'Você está revendo o histórico. Avance até a última posição para jogar.': ['You are reviewing the move history. Advance to the final position to play.','Você está revendo o histórico. Avance até a última posição para jogar.','Estás revisando el historial. Avanza hasta la última posición para jugar.','Vous consultez l’historique. Avancez jusqu’à la dernière position pour jouer.','Du siehst den Verlauf an. Gehe zur letzten Stellung, um zu spielen.','Stai rivedendo la cronologia. Avanza fino all’ultima posizione per giocare.','Je bekijkt de zetgeschiedenis. Ga naar de laatste positie om te spelen.','Вы просматриваете историю. Перейдите к последней позиции, чтобы сделать ход.','正在查看棋步历史。前进到最后一个局面即可开始走棋。','棋譜の履歴を確認中です。最後の局面まで進むと指せます。','기보 기록을 보고 있습니다. 마지막 포지션으로 이동하면 플레이할 수 있습니다.','Hamle geçmişini inceliyorsunuz. Oynamak için son konuma ilerleyin.','أنت تستعرض سجل النقلات. تقدّم إلى الوضعية الأخيرة للعب.','आप चाल इतिहास देख रहे हैं। खेलने के लिए अंतिम स्थिति तक जाएँ।'],
  'Jogue a melhor opção no tabuleiro.': ['Play the best move on the board.','Jogue a melhor opção no tabuleiro.','Juega la mejor opción en el tablero.','Jouez le meilleur coup sur l’échiquier.','Spiele den besten Zug auf dem Brett.','Gioca la mossa migliore sulla scacchiera.','Speel de beste zet op het bord.','Сделайте лучший ход на доске.','在棋盘上走出最佳着法。','盤面で最善手を指してください。','보드에서 최선의 수를 두세요.','Tahtada en iyi hamleyi yapın.','العب أفضل نقلة على الرقعة.','बोर्ड पर सर्वश्रेष्ठ चाल चलें।'],
  'Carregando completo (~95 MB)': ['Loading Full (~95 MB)','Carregando completo (~95 MB)','Cargando Full (~95 MB)','Chargement complet (~95 Mo)','Full wird geladen (~95 MB)','Caricamento Full (~95 MB)','Full laden (~95 MB)','Загрузка Full (~95 МБ)','正在加载完整版本（约 95 MB）','Full を読み込み中（約95 MB）','Full 로드 중 (약 95MB)','Full yükleniyor (~95 MB)','جارٍ تحميل الإصدار الكامل (~95 ميجابايت)','Full लोड हो रहा है (~95 MB)'],
  'Carregando Lite': ['Loading Lite','Carregando Lite','Cargando Lite','Chargement de Lite','Lite wird geladen','Caricamento Lite','Lite laden','Загрузка Lite','正在加载 Lite','Lite を読み込み中','Lite 로드 중','Lite yükleniyor','جارٍ تحميل Lite','Lite लोड हो रहा है'],
  'Motor interrompido. Tente iniciar outra análise.': ['Engine stopped. Try starting another analysis.','Motor interrompido. Tente iniciar outra análise.','El motor se detuvo. Intenta iniciar otro análisis.','Le moteur s’est arrêté. Essayez de lancer une autre analyse.','Engine gestoppt. Starte eine neue Analyse.','Motore interrotto. Prova ad avviare un’altra analisi.','Engine gestopt. Probeer een nieuwe analyse te starten.','Движок остановлен. Попробуйте начать новый анализ.','引擎已停止。请尝试重新开始分析。','エンジンが停止しました。別の解析を開始してください。','엔진이 중지되었습니다. 새 분석을 시작해 보세요.','Motor durdu. Yeni bir analiz başlatmayı deneyin.','توقف المحرك. حاول بدء تحليل آخر.','इंजन रुक गया। दूसरा विश्लेषण शुरू करें।'],
  'Indisponível': ['Unavailable','Indisponível','No disponible','Indisponible','Nicht verfügbar','Non disponibile','Niet beschikbaar','Недоступно','不可用','利用不可','사용할 수 없음','Kullanılamıyor','غير متاح','उपलब्ध नहीं'],
  'Posição final': ['Final position','Posição final','Posición final','Position finale','Endstellung','Posizione finale','Eindpositie','Финальная позиция','最终局面','最終局面','최종 포지션','Son konum','الوضعية النهائية','अंतिम स्थिति'],
  'O relatório está usando o motor': ['The report is using the engine','O relatório está usando o motor','El informe está usando el motor','Le rapport utilise le moteur','Der Bericht verwendet die Engine','Il report sta usando il motore','Het rapport gebruikt de engine','Отчёт использует движок','报告正在使用引擎','レポートがエンジンを使用しています','보고서에서 엔진을 사용 중입니다','Rapor motoru kullanıyor','يستخدم التقرير المحرك','रिपोर्ट इंजन का उपयोग कर रही है'],
  'Revisão interrompida.': ['Review stopped.','Revisão interrompida.','Revisión interrumpida.','Analyse interrompue.','Überprüfung unterbrochen.','Revisione interrotta.','Review onderbroken.','Анализ прерван.','复盘已中断。','レビューを中断しました。','복기가 중단되었습니다.','İnceleme durduruldu.','تم إيقاف المراجعة.','समीक्षा रोक दी गई।'],
  'O motor não retornou uma avaliação.': ['The engine did not return an evaluation.','O motor não retornou uma avaliação.','El motor no devolvió una evaluación.','Le moteur n’a renvoyé aucune évaluation.','Die Engine hat keine Bewertung zurückgegeben.','Il motore non ha restituito una valutazione.','De engine heeft geen evaluatie teruggegeven.','Движок не вернул оценку.','引擎未返回评估结果。','エンジンが評価を返しませんでした。','엔진이 평가를 반환하지 않았습니다.','Motor bir değerlendirme döndürmedi.','لم يُرجع المحرك تقييمًا.','इंजन ने कोई मूल्यांकन नहीं लौटाया।'],
  'Revisar de novo': ['Review again','Revisar de novo','Revisar de nuevo','Revoir','Erneut überprüfen','Rivedi di nuovo','Opnieuw reviewen','Повторить анализ','重新复盘','もう一度レビュー','다시 복기','Yeniden incele','مراجعة مرة أخرى','फिर से समीक्षा करें'],
  'Nome de usuário': ['Username','Nome de usuário','Nombre de usuario','Nom d’utilisateur','Benutzername','Nome utente','Gebruikersnaam','Имя пользователя','用户名','ユーザー名','사용자 이름','Kullanıcı adı','اسم المستخدم','उपयोगकर्ता नाम'],
  'FEN da posição': ['Position FEN','FEN da posição','FEN de la posición','FEN de la position','Positions-FEN','FEN della posizione','Positie-FEN','FEN позиции','局面 FEN','局面 FEN','포지션 FEN','Konum FEN','FEN الوضعية','स्थिति FEN'],
  'Analisar posição': ['Analyze position','Analisar posição','Analizar posición','Analyser la position','Stellung analysieren','Analizza posizione','Positie analyseren','Анализировать позицию','分析局面','局面を分析','포지션 분석','Konumu analiz et','تحليل الوضعية','स्थिति का विश्लेषण करें'],
  'Buscar partidas': ['Find games','Buscar partidas','Buscar partidas','Rechercher des parties','Partien suchen','Cerca partite','Partijen zoeken','Найти партии','查找棋局','棋譜を検索','대국 찾기','Oyun bul','البحث عن مباريات','खेल खोजें'],
  'Informe um nome de usuário válido.': ['Enter a valid username.','Informe um nome de usuário válido.','Introduce un nombre de usuario válido.','Saisissez un nom d’utilisateur valide.','Gib einen gültigen Benutzernamen ein.','Inserisci un nome utente valido.','Voer een geldige gebruikersnaam in.','Введите корректное имя пользователя.','请输入有效的用户名。','有効なユーザー名を入力してください。','올바른 사용자 이름을 입력하세요.','Geçerli bir kullanıcı adı girin.','أدخل اسم مستخدم صالحًا.','मान्य उपयोगकर्ता नाम दर्ज करें।'],
  'Usuário não encontrado.': ['User not found.','Usuário não encontrado.','Usuario no encontrado.','Utilisateur introuvable.','Benutzer nicht gefunden.','Utente non trovato.','Gebruiker niet gevonden.','Пользователь не найден.','未找到用户。','ユーザーが見つかりません。','사용자를 찾을 수 없습니다.','Kullanıcı bulunamadı.','لم يتم العثور على المستخدم.','उपयोगकर्ता नहीं मिला।'],
  'O serviço limitou as consultas. Tente daqui a pouco.': ['The service rate-limited requests. Try again shortly.','O serviço limitou as consultas. Tente daqui a pouco.','El servicio limitó las consultas. Inténtalo en un momento.','Le service a limité les requêtes. Réessayez dans un instant.','Der Dienst hat Anfragen begrenzt. Versuche es gleich erneut.','Il servizio ha limitato le richieste. Riprova tra poco.','De service heeft verzoeken beperkt. Probeer het straks opnieuw.','Сервис ограничил запросы. Попробуйте немного позже.','服务限制了请求。请稍后重试。','サービスのリクエスト制限に達しました。少し待って再試行してください。','서비스 요청이 제한되었습니다. 잠시 후 다시 시도하세요.','Hizmet istekleri sınırladı. Kısa süre sonra tekrar deneyin.','فرضت الخدمة حدًا على الطلبات. حاول مرة أخرى بعد قليل.','सेवा ने अनुरोध सीमित कर दिए हैं। थोड़ी देर बाद फिर प्रयास करें।'],
  'O serviço está indisponível no momento.': ['The service is currently unavailable.','O serviço está indisponível no momento.','El servicio no está disponible ahora.','Le service est actuellement indisponible.','Der Dienst ist derzeit nicht verfügbar.','Il servizio non è al momento disponibile.','De service is momenteel niet beschikbaar.','Сервис временно недоступен.','服务目前不可用。','現在サービスを利用できません。','현재 서비스를 사용할 수 없습니다.','Hizmet şu anda kullanılamıyor.','الخدمة غير متاحة حاليًا.','सेवा अभी उपलब्ध नहीं है।'],
  'Esta partida não pôde ser importada.': ['This game could not be imported.','Esta partida não pôde ser importada.','No se pudo importar esta partida.','Cette partie n’a pas pu être importée.','Diese Partie konnte nicht importiert werden.','Impossibile importare questa partita.','Deze partij kon niet worden geïmporteerd.','Не удалось импортировать эту партию.','无法导入此棋局。','この棋譜をインポートできませんでした。','이 대국을 가져올 수 없습니다.','Bu oyun içe aktarılamadı.','تعذّر استيراد هذه المباراة.','यह खेल आयात नहीं किया जा सका।'],
  'Nenhuma partida de xadrez padrão encontrada.': ['No standard chess games found.','Nenhuma partida de xadrez padrão encontrada.','No se encontraron partidas de ajedrez estándar.','Aucune partie d’échecs standard trouvée.','Keine Standard-Schachpartien gefunden.','Nessuna partita di scacchi standard trovata.','Geen standaard schaakpartijen gevonden.','Стандартные шахматные партии не найдены.','未找到标准国际象棋棋局。','標準的なチェスの対局が見つかりません。','표준 체스 대국을 찾을 수 없습니다.','Standart satranç oyunu bulunamadı.','لم يتم العثور على مباريات شطرنج قياسية.','कोई मानक शतरंज खेल नहीं मिला।'],
  'PGN inválido. Confira a notação e tente de novo.': ['Invalid PGN. Check the notation and try again.','PGN inválido. Confira a notação e tente de novo.','PGN no válido. Comprueba la notación e inténtalo de nuevo.','PGN invalide. Vérifiez la notation et réessayez.','Ungültiges PGN. Prüfe die Notation und versuche es erneut.','PGN non valido. Controlla la notazione e riprova.','Ongeldige PGN. Controleer de notatie en probeer opnieuw.','Некорректный PGN. Проверьте запись и попробуйте снова.','PGN 无效。请检查记谱并重试。','PGNが無効です。棋譜表記を確認して再試行してください。','잘못된 PGN입니다. 기보를 확인하고 다시 시도하세요.','Geçersiz PGN. Notasyonu kontrol edip tekrar deneyin.','PGN غير صالح. تحقق من الترميز وحاول مرة أخرى.','अमान्य PGN। नोटेशन जाँचें और पुनः प्रयास करें।'],
  'FEN inválido. Confira os campos da posição.': ['Invalid FEN. Check the position fields.','FEN inválido. Confira os campos da posição.','FEN no válido. Comprueba los campos de la posición.','FEN invalide. Vérifiez les champs de la position.','Ungültiges FEN. Prüfe die Stellungsfelder.','FEN non valido. Controlla i campi della posizione.','Ongeldige FEN. Controleer de positievelden.','Некорректный FEN. Проверьте поля позиции.','FEN 无效。请检查局面字段。','FENが無効です。局面の各フィールドを確認してください。','잘못된 FEN입니다. 포지션 필드를 확인하세요.','Geçersiz FEN. Konum alanlarını kontrol edin.','FEN غير صالح. تحقق من حقول الوضعية.','अमान्य FEN। स्थिति फ़ील्ड जाँचें।'],
  'A consulta falhou. Você também pode importar um PGN.': ['The request failed. You can also import a PGN.','A consulta falhou. Você também pode importar um PGN.','La consulta falló. También puedes importar un PGN.','La requête a échoué. Vous pouvez également importer un PGN.','Die Anfrage ist fehlgeschlagen. Du kannst auch ein PGN importieren.','La richiesta non è riuscita. Puoi anche importare un PGN.','Het verzoek is mislukt. Je kunt ook een PGN importeren.','Запрос не выполнен. Вы также можете импортировать PGN.','请求失败。你也可以导入 PGN。','リクエストに失敗しました。PGNをインポートすることもできます。','요청에 실패했습니다. PGN을 가져올 수도 있습니다.','İstek başarısız oldu. Ayrıca PGN içe aktarabilirsiniz.','فشل الطلب. يمكنك أيضًا استيراد ملف PGN.','अनुरोध विफल हुआ। आप PGN आयात भी कर सकते हैं।'],
  'Buscar partidas': ['Find games','Buscar partidas','Buscar partidas','Rechercher des parties','Partien suchen','Cerca partite','Partijen zoeken','Найти партии','查找棋局','棋譜を検索','대국 찾기','Oyun bul','البحث عن مباريات','खेल खोजें'],
  'Language': ['Language','Idioma','Idioma','Langue','Sprache','Lingua','Taal','Язык','语言','言語','언어','Dil','اللغة','भाषा'],
  'Choose your language': ['Choose your language','Escolha seu idioma','Elige tu idioma','Choisissez votre langue','Sprache auswählen','Scegli la lingua','Kies je taal','Выберите язык','选择语言','言語を選択','언어 선택','Dilinizi seçin','اختر لغتك','अपनी भाषा चुनें'],
  'Welcome to Move by Move': ['Welcome to Move by Move','Boas-vindas ao Move by Move','Te damos la bienvenida a Move by Move','Bienvenue sur Move by Move','Willkommen bei Move by Move','Benvenuto su Move by Move','Welkom bij Move by Move','Добро пожаловать в Move by Move','欢迎使用 Move by Move','Move by Move へようこそ','Move by Move에 오신 것을 환영합니다','Move by Move’a hoş geldiniz','مرحبًا بك في Move by Move','Move by Move में आपका स्वागत है'],
  'Choose your interface language before getting started. You can change it at any time.': ['Choose your interface language before getting started. You can change it at any time.','Escolha o idioma da interface antes de começar. Você poderá alterá-lo a qualquer momento.','Elige el idioma de la interfaz antes de comenzar. Podrás cambiarlo en cualquier momento.','Choisissez la langue de l’interface avant de commencer. Vous pourrez la modifier à tout moment.','Wähle vor dem Start die Sprache der Oberfläche. Du kannst sie jederzeit ändern.','Scegli la lingua dell’interfaccia prima di iniziare. Potrai cambiarla in qualsiasi momento.','Kies de interfacetaal voordat je begint. Je kunt deze op elk moment wijzigen.','Выберите язык интерфейса перед началом. Его можно изменить в любой момент.','开始前请选择界面语言。之后随时可以更改。','開始する前に表示言語を選択してください。いつでも変更できます。','시작하기 전에 인터페이스 언어를 선택하세요. 언제든지 변경할 수 있습니다.','Başlamadan önce arayüz dilini seçin. Dili istediğiniz zaman değiştirebilirsiniz.','اختر لغة الواجهة قبل البدء. يمكنك تغييرها في أي وقت.','शुरू करने से पहले इंटरफ़ेस भाषा चुनें। आप इसे कभी भी बदल सकते हैं।'],
  'Continue to analysis': ['Continue to analysis','Continuar para análise','Continuar al análisis','Continuer vers l’analyse','Weiter zur Analyse','Continua all’analisi','Doorgaan naar analyse','Перейти к анализу','进入分析','解析へ進む','분석으로 이동','Analize devam et','متابعة إلى التحليل','विश्लेषण पर जाएँ'],
  'You can change your language from the top navigation at any time.': ['You can change your language from the top navigation at any time.','Você pode mudar o idioma pela navegação superior a qualquer momento.','Puedes cambiar el idioma desde la navegación superior en cualquier momento.','Vous pouvez changer de langue depuis la navigation supérieure à tout moment.','Du kannst die Sprache jederzeit über die obere Navigation ändern.','Puoi cambiare lingua in qualsiasi momento dalla navigazione superiore.','Je kunt de taal op elk moment wijzigen via de bovenste navigatie.','Язык можно изменить в верхней панели навигации в любое время.','你可以随时通过顶部导航更改语言。','上部ナビゲーションからいつでも言語を変更できます。','상단 메뉴에서 언제든지 언어를 변경할 수 있습니다.','Dili istediğiniz zaman üst gezinme menüsünden değiştirebilirsiniz.','يمكنك تغيير اللغة من شريط التنقل العلوي في أي وقت.','आप ऊपर के नेविगेशन से कभी भी भाषा बदल सकते हैं।']
};


Object.assign(MESSAGES, {
  'Move by Move — Chess Analysis': ['Move by Move — Chess Analysis','Move by Move — Análise de xadrez','Move by Move — Análisis de ajedrez','Move by Move — Analyse échiquéenne','Move by Move — Schachanalyse','Move by Move — Analisi scacchistica','Move by Move — Schaakanalyse','Move by Move — Анализ шахмат','Move by Move — 国际象棋分析','Move by Move — チェス分析','Move by Move — 체스 분석','Move by Move — Satranç analizi','Move by Move — تحليل الشطرنج','Move by Move — शतरंज विश्लेषण'],
  'Vantagem das brancas': ['White advantage','Vantagem das brancas','Ventaja de las blancas','Avantage des Blancs','Vorteil Weiß','Vantaggio del Bianco','Voordeel wit','Преимущество белых','白方优势','白の優勢','백의 우세','Beyazın avantajı','أفضلية الأبيض','सफेद की बढ़त'],
  'Casas do tabuleiro': ['Board squares','Casas do tabuleiro','Casillas del tablero','Cases de l’échiquier','Brettfelder','Case della scacchiera','Bordvelden','Поля доски','棋盘格','盤面のマス','보드 칸','Tahta kareleri','مربعات الرقعة','बोर्ड के खाने'],
  'Botão direito: arraste para desenhar uma seta ou clique para marcar uma casa. Vermelho é o padrão. Shift: azul · Ctrl: verde · Alt: amarelo. Clique esquerdo limpa marcações.': ['Right-click and drag to draw an arrow, or click to mark a square. Red is the default. Shift: blue · Ctrl: green · Alt: yellow. Left-click clears annotations.','Botão direito: arraste para desenhar uma seta ou clique para marcar uma casa. Vermelho é o padrão. Shift: azul · Ctrl: verde · Alt: amarelo. Clique esquerdo limpa marcações.','Clic derecho y arrastra para dibujar una flecha, o haz clic para marcar una casilla. El rojo es el color predeterminado. Shift: azul · Ctrl: verde · Alt: amarillo. Clic izquierdo borra las marcas.','Clic droit-glisser pour dessiner une flèche, ou cliquer pour marquer une case. Le rouge est la couleur par défaut. Maj : bleu · Ctrl : vert · Alt : jaune. Clic gauche pour effacer.','Rechtsklick und ziehen, um einen Pfeil zu zeichnen, oder klicken, um ein Feld zu markieren. Rot ist Standard. Umschalt: Blau · Strg: Grün · Alt: Gelb. Linksklick löscht Markierungen.','Clic destro e trascina per disegnare una freccia, oppure clicca per segnare una casella. Il rosso è predefinito. Maiusc: blu · Ctrl: verde · Alt: giallo. Clic sinistro cancella le annotazioni.','Klik met rechts en sleep om een pijl te tekenen, of klik om een veld te markeren. Rood is standaard. Shift: blauw · Ctrl: groen · Alt: geel. Klik links om markeringen te wissen.','Щёлкните правой кнопкой и перетащите, чтобы нарисовать стрелку, или щёлкните по полю, чтобы отметить его. По умолчанию используется красный. Shift: синий · Ctrl: зелёный · Alt: жёлтый. Левая кнопка удаляет отметки.','右键拖动可绘制箭头，右键单击可标记格子。默认颜色为红色。Shift：蓝色 · Ctrl：绿色 · Alt：黄色。左键单击可清除标记。','右クリックしてドラッグすると矢印を描画、クリックするとマスをマークします。既定色は赤です。Shift：青 · Ctrl：緑 · Alt：黄。左クリックでマークを消去します。','마우스 오른쪽 버튼을 드래그해 화살표를 그리거나 클릭해 칸을 표시하세요. 기본 색상은 빨간색입니다. Shift: 파랑 · Ctrl: 초록 · Alt: 노랑. 왼쪽 클릭으로 표시를 지웁니다.','Ok çizmek için sağ tıklayıp sürükleyin veya bir kareyi işaretlemek için tıklayın. Varsayılan renk kırmızıdır. Shift: mavi · Ctrl: yeşil · Alt: sarı. Sol tıklama işaretleri temizler.','انقر بزر الفأرة الأيمن واسحب لرسم سهم، أو انقر لتحديد مربع. اللون الأحمر هو الافتراضي. Shift: أزرق · Ctrl: أخضر · Alt: أصفر. انقر بزر الفأرة الأيسر لمسح العلامات.','तीर बनाने के लिए दायाँ-क्लिक करके खींचें या खाने को चिह्नित करने के लिए क्लिक करें। डिफ़ॉल्ट रंग लाल है। Shift: नीला · Ctrl: हरा · Alt: पीला। बायाँ-क्लिक चिह्न हटाता है।'],
  'Melhor lance': ['Best move','Melhor lance','Mejor jugada','Meilleur coup','Bester Zug','Mossa migliore','Beste zet','Лучший ход','最佳着法','最善手','최선의 수','En iyi hamle','أفضل نقلة','सर्वश्रेष्ठ चाल'],
  'Excelente': ['Excellent','Excelente','Excelente','Excellent','Ausgezeichnet','Eccellente','Uitstekend','Отлично','优秀','優秀','훌륭함','Mükemmel','ممتاز','उत्कृष्ट'],
  'Bom lance': ['Good move','Bom lance','Buena jugada','Bon coup','Guter Zug','Buona mossa','Goede zet','Хороший ход','好棋','好手','좋은 수','İyi hamle','نقلة جيدة','अच्छी चाल'],
  'Peão': ['Pawn','Peão','Peón','Pion','Bauer','Pedone','Pion','Пешка','兵','ポーン','폰','Piyon','بيدق','प्यादा'],
  'Cavalo': ['Knight','Cavalo','Caballo','Cavalier','Springer','Cavallo','Paard','Конь','马','ナイト','나이트','At','حصان','घोड़ा'],
  'Bispo': ['Bishop','Bispo','Alfil','Fou','Läufer','Alfiere','Loper','Слон','象','ビショップ','비숍','Fil','فيل','ऊँट'],
  'Torre': ['Rook','Torre','Torre','Tour','Turm','Torre','Toren','Ладья','车','ルーク','룩','Kale','قلعة','हाथी'],
  'Dama': ['Queen','Dama','Dama','Dame','Dame','Donna','Dame','Ферзь','后','クイーン','퀸','Vezir','وزير','वज़ीर'],
  'Rei': ['King','Rei','Rey','Roi','König','Re','Koning','Король','王','キング','킹','Şah','ملك','राजा'],
  'Primeiro lance': ['First move','Primeiro lance','Primera jugada','Premier coup','Erster Zug','Prima mossa','Eerste zet','Первый ход','第一步','最初の手','첫 수','İlk hamle','النقلة الأولى','पहली चाल'],
  'Último lance': ['Last move','Último lance','Última jugada','Dernier coup','Letzter Zug','Ultima mossa','Laatste zet','Последний ход','最后一步','最後の手','마지막 수','Son hamle','النقلة الأخيرة','आखिरी चाल'],
  'Voltar ao início': ['Go to start','Voltar ao início','Ir al inicio','Revenir au début','Zum Anfang','Vai all’inizio','Naar begin','В начало','回到开头','最初に戻る','처음으로','Başa dön','العودة إلى البداية','शुरुआत पर जाएँ'],
  'Faixa indicativa: ': ['Indicative range: ','Faixa indicativa: ','Rango orientativo: ','Fourchette indicative : ','Orientierungsbereich: ','Intervallo indicativo: ','Indicatieve bandbreedte: ','Ориентировочный диапазон: ','参考范围：','目安の範囲：','참고 범위: ','Yaklaşık aralık: ','النطاق الإرشادي: ','अनुमानित सीमा: '],
  'Treinar no puzzle': ['Train with a puzzle','Treinar no puzzle','Practicar con un problema','S’entraîner avec un problème','Mit einer Aufgabe trainieren','Allenati con un problema','Train met een puzzel','Решить задачу','通过谜题训练','パズルで練習','퍼즐로 훈련','Bulmaca çöz','التدرب على لغز','पहेली से अभ्यास करें'],
  'Treinar em ': ['Train in ','Treinar em ','Practicar en ','S’entraîner sur ','Trainieren mit ','Allenati con ','Train met ','Тренировка: ','训练 ','練習：','훈련: ','Şunlarda antrenman: ','التدرب على ','इनमें अभ्यास करें: '],
  ' puzzles': [' puzzles',' puzzles',' problemas',' problèmes',' Aufgaben',' problemi',' puzzels',' задач',' 道谜题',' 問のパズル',' 퍼즐',' bulmaca',' ألغاز',' पहेलियाँ'],
  'Antes ': ['Before ','Antes ','Antes ','Avant ','Vorher ','Prima ','Voor ','До ','之前 ','前 ','이전 ','Önce ','قبل ','पहले '],
  'Depois ': ['After ','Depois ','Después ','Après ','Nachher ','Dopo ','Na ','После ','之后 ','後 ','이후 ','Sonra ','بعد ','बाद '],
  'Ver ': ['View ','Ver ','Ver ','Voir ','Ansehen: ','Visualizza ','Bekijk ','Показать ','查看 ','表示：','보기: ','Görüntüle ','عرض ','देखें: '],
  ' no tabuleiro': [' on board',' no tabuleiro',' en el tablero',' sur l’échiquier',' auf dem Brett',' sulla scacchiera',' op het bord',' на доске',' 在棋盘上',' 盤面で',' 보드에서',' tahtada',' على الرقعة',' बोर्ड पर'],
  'Tentar como puzzle': ['Try as a puzzle','Tentar como puzzle','Probar como problema','Essayer comme problème','Als Aufgabe versuchen','Prova come problema','Probeer als puzzel','Решить как задачу','作为谜题尝试','パズルとして挑戦','퍼즐로 도전','Bulmaca olarak dene','جرّب كلغز','पहेली के रूप में आज़माएँ'],
  'Encontre alternativas melhores para os seus lances.': ['Find better alternatives for your moves.','Encontre alternativas melhores para os seus lances.','Encuentra mejores alternativas para tus jugadas.','Trouvez de meilleures alternatives à vos coups.','Finde bessere Alternativen für deine Züge.','Trova alternative migliori per le tue mosse.','Vind betere alternatieven voor je zetten.','Найдите лучшие альтернативы своим ходам.','为你的着法寻找更好的选择。','自分の手に対するより良い代案を見つけましょう。','자신의 수에 대한 더 나은 대안을 찾아보세요.','Hamleleriniz için daha iyi alternatifler bulun.','اعثر على بدائل أفضل لنقلاتك.','अपनी चालों के बेहतर विकल्प खोजें।'],
  'Puzzle resolvido': ['Puzzle solved','Puzzle resolvido','Problema resuelto','Problème résolu','Aufgabe gelöst','Problema risolto','Puzzel opgelost','Задача решена','谜题已解决','パズル解決','퍼즐 해결','Bulmaca çözüldü','تم حل اللغز','पहेली हल हो गई'],
  'O melhor lance era ': ['The best move was ','O melhor lance era ','La mejor jugada era ','Le meilleur coup était ','Der beste Zug war ','La mossa migliore era ','De beste zet was ','Лучшим ходом был ','最佳着法是 ','最善手は','최선의 수는 ','En iyi hamle ','أفضل نقلة كانت ','सर्वश्रेष्ठ चाल थी '],
  'O motor não retornou uma avaliação.': ['The engine did not return an evaluation.','O motor não retornou uma avaliação.','El motor no devolvió una evaluación.','Le moteur n’a renvoyé aucune évaluation.','Die Engine hat keine Bewertung zurückgegeben.','Il motore non ha restituito una valutazione.','De engine heeft geen evaluatie teruggegeven.','Движок не вернул оценку.','引擎未返回评估结果。','エンジンが評価を返しませんでした。','엔진이 평가를 반환하지 않았습니다.','Motor bir değerlendirme döndürmedi.','لم يُرجع المحرك تقييمًا.','इंजन ने कोई मूल्यांकन नहीं लौटाया।'],
  'Iniciando Stockfish 19…': ['Starting Stockfish 19…','Iniciando Stockfish 19…','Iniciando Stockfish 19…','Démarrage de Stockfish 19…','Stockfish 19 wird gestartet…','Avvio di Stockfish 19…','Stockfish 19 starten…','Запуск Stockfish 19…','正在启动 Stockfish 19…','Stockfish 19 を起動中…','Stockfish 19 시작 중…','Stockfish 19 başlatılıyor…','جارٍ تشغيل Stockfish 19…','Stockfish 19 शुरू हो रहा है…'],
  'Parar': ['Stop','Parar','Detener','Arrêter','Stoppen','Ferma','Stoppen','Остановить','停止','停止','중지','Durdur','إيقاف','रोकें'],
  'Pausar': ['Pause','Pausar','Pausar','Pause','Pause','Pausa','Pauzeren','Пауза','暂停','一時停止','일시정지','Duraklat','إيقاف مؤقت','रोकें'],
  'Retomar': ['Resume','Retomar','Reanudar','Reprendre','Fortsetzen','Riprendi','Hervatten','Продолжить','继续','再開','재개','Sürdür','استئناف','फिर शुरू करें'],
  'Buscar partidas': ['Find games','Buscar partidas','Buscar partidas','Rechercher des parties','Partien suchen','Cerca partite','Partijen zoeken','Найти партии','查找棋局','棋譜を検索','대국 찾기','Oyun bul','البحث عن مباريات','खेल खोजें'],
  'Posição de exemplo': ['Sample position','Posição de exemplo','Posición de ejemplo','Position exemple','Beispielstellung','Posizione di esempio','Voorbeeldstelling','Пример позиции','示例局面','サンプル局面','예제 포지션','Örnek konum','وضعية تجريبية','उदाहरण स्थिति'],
  'Posição de meio-jogo': ['Middlegame position','Posição de meio-jogo','Posición de medio juego','Position de milieu de jeu','Mittelspielstellung','Posizione di mediogioco','Middenspelstelling','Позиция миттельшпиля','中局局面','中盤の局面','미들게임 포지션','Oyun ortası konumu','وضعية وسط اللعب','मध्य खेल स्थिति'],
  'Buscar': ['Find','Buscar','Buscar','Rechercher','Suchen','Cerca','Zoeken','Найти','查找','検索','찾기','Bul','بحث','खोजें'],
  'Buscando…': ['Searching…','Buscando…','Buscando…','Recherche…','Suche…','Ricerca…','Zoeken…','Поиск…','正在搜索…','検索中…','검색 중…','Aranıyor…','جارٍ البحث…','खोज रहे हैं…'],
  'Copiado.': ['Copied.','Copiado.','Copiado.','Copié.','Kopiert.','Copiato.','Gekopieerd.','Скопировано.','已复制。','コピーしました。','복사되었습니다.','Kopyalandı.','تم النسخ.','कॉपी किया गया।'],
  'O navegador bloqueou o acesso à área de transferência.': ['The browser blocked clipboard access.','O navegador bloqueou o acesso à área de transferência.','El navegador bloqueó el acceso al portapapeles.','Le navigateur a bloqué l’accès au presse-papiers.','Der Browser hat den Zugriff auf die Zwischenablage blockiert.','Il browser ha bloccato l’accesso agli appunti.','De browser heeft klembordtoegang geblokkeerd.','Браузер заблокировал доступ к буферу обмена.','浏览器阻止了剪贴板访问。','ブラウザーがクリップボードへのアクセスをブロックしました。','브라우저에서 클립보드 접근을 차단했습니다.','Tarayıcı pano erişimini engelledi.','حظر المتصفح الوصول إلى الحافظة.','ब्राउज़र ने क्लिपबोर्ड एक्सेस रोक दिया।'],
  'Use um arquivo PGN menor que 1 MB.': ['Use a PGN file smaller than 1 MB.','Use um arquivo PGN menor que 1 MB.','Usa un archivo PGN de menos de 1 MB.','Utilisez un fichier PGN de moins de 1 Mo.','Verwende eine PGN-Datei unter 1 MB.','Usa un file PGN più piccolo di 1 MB.','Gebruik een PGN-bestand kleiner dan 1 MB.','Используйте файл PGN размером менее 1 МБ.','请使用小于 1 MB 的 PGN 文件。','1 MB 未満の PGN ファイルを使用してください。','1MB보다 작은 PGN 파일을 사용하세요.','1 MB’tan küçük bir PGN dosyası kullanın.','استخدم ملف PGN أصغر من 1 ميجابايت.','1 MB से छोटी PGN फ़ाइल का उपयोग करें।'],
  'Esta partida é longa para um link. Exporte o PGN.': ['This game is too long for a link. Export the PGN instead.','Esta partida é longa para um link. Exporte o PGN.','Esta partida es demasiado larga para un enlace. Exporta el PGN.','Cette partie est trop longue pour un lien. Exportez plutôt le PGN.','Diese Partie ist zu lang für einen Link. Exportiere stattdessen das PGN.','Questa partita è troppo lunga per un link. Esporta il PGN.','Deze partij is te lang voor een link. Exporteer de PGN.','Партия слишком длинная для ссылки. Экспортируйте PGN.','棋局过长，无法生成链接。请改为导出 PGN。','この棋譜はリンクには長すぎます。PGNをエクスポートしてください。','대국이 링크에 비해 너무 깁니다. PGN을 내보내세요.','Bu oyun bağlantı için çok uzun. Bunun yerine PGN’yi dışa aktarın.','هذه المباراة طويلة جدًا لإنشاء رابط. صدّر PGN بدلًا من ذلك.','यह खेल लिंक के लिए बहुत लंबा है। इसके बजाय PGN निर्यात करें।'],
  'Partida salva no arquivo local.': ['Game saved to the local library.','Partida salva no arquivo local.','Partida guardada en la biblioteca local.','Partie enregistrée dans la bibliothèque locale.','Partie in der lokalen Bibliothek gespeichert.','Partita salvata nell’archivio locale.','Partij opgeslagen in de lokale bibliotheek.','Партия сохранена в локальную библиотеку.','棋局已保存到本地资料库。','棋譜をローカルライブラリに保存しました。','대국이 로컬 보관함에 저장되었습니다.','Oyun yerel arşive kaydedildi.','تم حفظ المباراة في المكتبة المحلية.','खेल स्थानीय लाइब्रेरी में सहेजा गया।'],
  'Não foi possível salvar a partida neste navegador.': ['Could not save the game in this browser.','Não foi possível salvar a partida neste navegador.','No se pudo guardar la partida en este navegador.','Impossible d’enregistrer la partie dans ce navigateur.','Die Partie konnte in diesem Browser nicht gespeichert werden.','Impossibile salvare la partita in questo browser.','De partij kon niet in deze browser worden opgeslagen.','Не удалось сохранить партию в этом браузере.','无法在此浏览器中保存棋局。','このブラウザーに棋譜を保存できませんでした。','이 브라우저에 대국을 저장할 수 없습니다.','Oyun bu tarayıcıya kaydedilemedi.','تعذر حفظ المباراة في هذا المتصفح.','इस ब्राउज़र में खेल सहेजा नहीं जा सका।'],
  'Não foi possível abrir essa partida.': ['Could not open this game.','Não foi possível abrir essa partida.','No se pudo abrir esta partida.','Impossible d’ouvrir cette partie.','Diese Partie konnte nicht geöffnet werden.','Impossibile aprire questa partita.','Deze partij kon niet worden geopend.','Не удалось открыть эту партию.','无法打开此棋局。','この棋譜を開けませんでした。','이 대국을 열 수 없습니다.','Bu oyun açılamadı.','تعذر فتح هذه المباراة.','यह खेल नहीं खुल सका।'],
  'O link contém uma partida ou posição inválida.': ['The link contains an invalid game or position.','O link contém uma partida ou posição inválida.','El enlace contiene una partida o posición no válida.','Le lien contient une partie ou une position invalide.','Der Link enthält eine ungültige Partie oder Stellung.','Il link contiene una partita o una posizione non valida.','De link bevat een ongeldige partij of positie.','Ссылка содержит некорректную партию или позицию.','链接包含无效棋局或局面。','リンクに無効な棋譜または局面が含まれています。','링크에 잘못된 대국 또는 포지션이 포함되어 있습니다.','Bağlantı geçersiz bir oyun veya konum içeriyor.','يحتوي الرابط على مباراة أو وضعية غير صالحة.','लिंक में अमान्य खेल या स्थिति है।'],
  'O Stockfish escolheu ': ['Stockfish chose ','O Stockfish escolheu ','Stockfish eligió ','Stockfish a choisi ','Stockfish wählte ','Stockfish ha scelto ','Stockfish koos ','Stockfish выбрал ','Stockfish 选择了','Stockfish は次を選択しました：','Stockfish가 선택한 수: ','Stockfish şunu seçti: ','اختار Stockfish ','Stockfish ने चुना '],
  ' como a melhor opção desta posição.': [' as the best option in this position.',' como a melhor opção desta posição.',' como la mejor opción en esta posición.',' comme meilleure option dans cette position.',' als beste Option in dieser Stellung.',' come migliore opzione in questa posizione.',' als beste optie in deze stelling.',' как лучший вариант в этой позиции.',' 作为此局面的最佳选择。',' をこの局面での最善手として選びました。',' 이 포지션의 최선의 선택으로 평가했습니다.',' bu konumdaki en iyi seçenek olarak.',' كأفضل خيار في هذه الوضعية.',' को इस स्थिति में सर्वश्रेष्ठ विकल्प माना।'],
  'Depois de ': ['After ','Depois de ','Después de ','Après ','Nach ','Dopo ','Na ','После ','在',' の後、',' 이후 ','Sonrasında ','بعد ','के बाद '],
  ', o adversário dá mate imediatamente com ': [', the opponent can deliver immediate checkmate with ', ', o adversário dá mate imediatamente com ', ', el rival puede dar jaque mate inmediatamente con ', ', l’adversaire peut mater immédiatement avec ', ', kann der Gegner sofort mit ', ', l’avversario può dare matto immediatamente con ', ', kan de tegenstander direct mat zetten met ', ', соперник может сразу поставить мат ходом ', '，对手可以立即用','、相手はすぐに次の手でチェックメイトできます：',' 상대는 다음 수로 즉시 체크메이트할 수 있습니다: ', ', rakip şu hamleyle hemen mat edebilir: ', '، يستطيع الخصم تحقيق كش مات فورًا باستخدام ', ' के बाद प्रतिद्वंद्वी तुरंत मात दे सकता है: '],
  '. O motor recomenda ': ['. The engine recommends ',' . O motor recomenda ','. El motor recomienda ','. Le moteur recommande ','. Die Engine empfiehlt ','. Il motore consiglia ','. De engine adviseert ','. Движок рекомендует ', '。引擎建议','。エンジンの推奨手は','。엔진의 추천 수는','. Motor şunu öneriyor: ',' . يوصي المحرك بـ ','। इंजन सुझाव देता है '],
  ', o adversário passa a ter mate forçado em ': [', the opponent now has forced mate in ', ', o adversário passa a ter mate forçado em ', ', el rival ahora tiene mate forzado en ', ', l’adversaire dispose maintenant d’un mat forcé en ', ', hat der Gegner ein erzwungenes Matt in ', ', l’avversario ha ora un matto forzato in ', ', heeft de tegenstander nu geforceerd mat in ', ', у соперника теперь форсированный мат за ', '，对手现在有','、相手は','、상대는',' hamlede zorunlu mat bulur: ', '، أصبح لدى الخصم كش مات قسري خلال ',' चालों में प्रतिद्वंद्वी के पास जबरन मात है: '],
  '. Com ': ['. With ',' . Com ','. Con ','. Avec ','. Mit ','. Con ','. Met ','. С ходом ','。如果走','。','。',' ile ',' . باستخدام ','। '],
  ', essa sequência é evitada.': [', that sequence is avoided.', ', essa sequência é evitada.', ', se evita esa secuencia.', ', cette séquence est évitée.', ', wird diese Sequenz vermieden.', ', quella sequenza viene evitata.', ', wordt die reeks vermeden.', ', эта последовательность предотвращается.', '，即可避免这条变化。','、その手順を防げます。','로 해당 수순을 피할 수 있습니다.',' bu dizi önlenir.','، يتم تجنب هذا التسلسل.',' से उस क्रम से बचा जा सकता है।'],
  ' iniciava um mate forçado em ': [' started a forced mate in ',' iniciava um mate forçado em ',' iniciaba un mate forzado en ',' lançait un mat forcé en ',' leitete ein erzwungenes Matt in ',' iniziava un matto forzato in ',' begon een geforceerde mat in ',' начинал форсированный мат за ',' 开始了',' で強制メイトを開始しました。',' 수로 강제 메이트를 시작했습니다.',' hamlede zorunlu mat başlatıyordu: ',' بدأ كش مات إجباريًا خلال ',' में जबरन मात शुरू करता था '],
  '. Ao jogar ': ['. By playing ',' . Ao jogar ','. Al jugar ','. En jouant ','. Mit dem Zug ',' . Giocando ','. Door ',' . Сыграв ', '。如果走','。','。',' oynayarak ',' . عند لعب ','। '],
  ', você perdeu essa sequência.': [', you missed that sequence.', ', você perdeu essa sequência.', ', perdiste esa secuencia.', ', vous avez manqué cette séquence.', ', hast du diese Sequenz verpasst.', ', hai perso quella sequenza.', ', heb je die reeks gemist.', ', вы упустили эту последовательность.', '，你错过了这条变化。','、その手順を逃しました。',' 해당 수순을 놓쳤습니다.',' bu diziyi kaçırdınız.','، فقدت هذا التسلسل.',' से आप वह क्रम चूक गए।'],
  'A resposta ': ['The reply ','A resposta ','La respuesta ','La réponse ','Die Antwort ','La risposta ','Het antwoord ','Ответ ','应对着法','応手は','응수는','Yanıt ','الرد ','जवाब '],
  ' captura ': [' captures ',' captura ',' captura ',' capture ',' schlägt ',' cattura ',' slaat ',' берёт ',' 吃掉',' を取ります：',' 를 잡습니다: ',' alır: ',' تأسر ',' को पकड़ती है '],
  'Na continuação analisada, ': ['In the analyzed continuation, ','Na continuação analisada, ','En la continuación analizada, ','Dans la suite analysée, ','In der analysierten Fortsetzung, ','Nella continuazione analizzata, ','In de geanalyseerde voortzetting, ','В проанализированном продолжении ','在分析的后续变化中，','分析した継続手順では、','분석한 후속 수순에서 ','Analiz edilen devamda ','في المتابعة التي تم تحليلها، ','विश्लेषित निरंतरता में, '],
  ' preserva cerca de ': [' preserves about ',' preserva cerca de ',' conserva aproximadamente ',' préserve environ ',' erhält etwa ',' preserva circa ',' behoudt ongeveer ',' сохраняет около ',' 保留约',' を約',' 를 약',' yaklaşık',' تحافظ على نحو ',' लगभग '],
  ' ponto': [' point',' ponto',' punto',' point',' Punkt',' punto',' punt',' пункт',' 分',' 点',' 점',' puan',' نقطة',' अंक'],
  ' pontos': [' points',' pontos',' puntos',' points',' Punkte',' punti',' punten',' пункта',' 分',' 点',' 점',' puan',' نقاط',' अंक'],
  'A avaliação piora para o lado que jogou ': ['The evaluation worsens for the side that played ','A avaliação piora para o lado que jogou ','La evaluación empeora para el bando que jugó ','L’évaluation se dégrade pour le camp qui a joué ','Die Bewertung verschlechtert sich für die Seite, die ','La valutazione peggiora per il lato che ha giocato ','De evaluatie verslechtert voor de partij die ','Оценка ухудшается для стороны, сыгравшей ','局面评估对走出',' この手を指した側にとって評価が悪化します：',' 이 수를 둔 쪽의 평가가 나빠집니다: ',' hamlesini yapan taraf için değerlendirme kötüleşiyor: ',' يتراجع التقييم للجانب الذي لعب ',' जिस पक्ष ने यह चाल चली उसके लिए मूल्यांकन खराब होता है '],
  '. O adversário pode responder com ': ['. The opponent can reply with ',' . O adversário pode responder com ','. El rival puede responder con ','. L’adversaire peut répondre par ','. Der Gegner kann mit ','. L’avversario può rispondere con ','. De tegenstander kan antwoorden met ','. Соперник может ответить ходом ', '。对手可以应对','。相手は次に','。상대는 다음 수로 응수할 수 있습니다: ',' Rakip şu hamleyle karşılık verebilir: ',' . يمكن للخصم الرد بـ ','। प्रतिद्वंद्वी जवाब दे सकता है '],
  ' Compare essa sequência com a continuação após ': ['. Compare this line with the continuation after ',' Compare essa sequência com a continuação após ','. Compara esta secuencia con la continuación tras ','. Comparez cette séquence avec la suite après ','. Vergleiche diese Variante mit der Fortsetzung nach ','. Confronta questa sequenza con la continuazione dopo ','. Vergelijk deze reeks met de voortzetting na ','. Сравните эту последовательность с продолжением после ','。请将这条变化与之后的续着进行比较：','。次の手以降の継続手順と比較してください：','。다음 수 이후의 후속 수순과 비교하세요: ',' hamlesinden sonraki devamla karşılaştırın. ',' . قارن هذا التسلسل بالمتابعة بعد ','। इस क्रम की तुलना इसके बाद की निरंतरता से करें '],
  'A posição após ': ['The position after ','A posição após ','La posición después de ','La position après ','Die Stellung nach ','La posizione dopo ','De stelling na ','Позиция после ','走出',' の後の局面は',' 이후 포지션은',' sonrasındaki konum ','الوضعية بعد ','के बाद की स्थिति '],
  ' ficou próxima da melhor linha encontrada, que começa com ': [' remained close to the best line found, which starts with ',' ficou próxima da melhor linha encontrada, que começa com ',' quedó cerca de la mejor línea encontrada, que comienza con ',' est proche de la meilleure variante trouvée, qui commence par ',' liegt nahe an der besten gefundenen Variante, die mit ',' è rimasta vicina alla migliore linea trovata, che inizia con ',' bleef dicht bij de beste gevonden lijn, die begint met ',' близка к лучшей найденной линии, начинающейся с ',' 与找到的最佳变化接近，该变化以',' は、次の手で始まる最善手順に近いままです：',' 는 다음 수로 시작하는 최선의 수순과 가까웠습니다: ',' bulunan en iyi çizgiye yakın kaldı; bu çizgi şu hamleyle başlıyor: ',' بقيت قريبة من أفضل خط تم العثور عليه، والذي يبدأ بـ ',' सबसे अच्छी मिली लाइन के करीब रही, जो इस चाल से शुरू होती है '],
  'Último lance do adversário: ': ['Opponent’s previous move: ','Último lance do adversário: ','Última jugada del rival: ','Dernier coup adverse : ','Letzter Zug des Gegners: ','Ultima mossa dell’avversario: ','Vorige zet van de tegenstander: ','Предыдущий ход соперника: ','对手上一步：','相手の直前の手：','상대의 직전 수: ','Rakibin önceki hamlesi: ','نقلة الخصم السابقة: ','प्रतिद्वंद्वी की पिछली चाल: '],
  ' Ir para ': [' Go to ',' Ir para ',' Ir a ',' Aller à ',' Gehe zu ',' Vai a ',' Ga naar ',' Перейти к ',' 跳转到 ',' に移動 ',' 이동: ',' Şuraya git: ',' الانتقال إلى ',' जाएँ: ']
});


Object.assign(MESSAGES, {
  'Variações': ['Variations','Variações','Variantes','Variantes','Varianten','Varianti','Varianten','Варианты','变化','変化','수순','Varyantlar','التحليلات','विकल्प'],
  'Posição ': ['Position ','Posição ','Posición ','Position ','Stellung ','Posizione ','Positie ','Позиция ','局面 ','局面 ','포지션 ','Konum ','الوضعية ','स्थिति '],
  'Você jogou ': ['You played ','Você jogou ','Jugaste ','Vous avez joué ','Du hast ','Hai giocato ','Je speelde ','Вы сыграли ','你走了','あなたは','당신이 둔 수: ','Şunu oynadınız: ','لقد لعبت ','आपने खेला '],
  ' resolve a posição.': [' solves the position.',' resolve a posição.',' resuelve la posición.',' résout la position.',' löst die Stellung.',' risolve la posizione.',' lost de stelling op.',' решает позицию.',' 可以解决局面。',' で局面を解決できます。',' 포지션을 해결합니다.',' konumu çözer.',' يحل الوضعية.',' स्थिति हल करता है।'],
  ' não resolve.': [' does not solve it.',' não resolve.',' no resuelve.',' ne résout pas la position.',' löst die Stellung nicht.',' non risolve.',' lost de stelling niet op.',' не решает позицию.',' 无法解决局面。',' では解決できません。',' 해결하지 못합니다.',' çözmüyor.',' لا يحل الوضعية.',' हल नहीं करता।'],
  'lances analisados; são necessários pelo menos 5.': ['moves analyzed; at least 5 are required.','lances analisados; são necessários pelo menos 5.','jugadas analizadas; se necesitan al menos 5.','coups analysés ; 5 au minimum sont nécessaires.','Züge analysiert; mindestens 5 sind erforderlich.','mosse analizzate; ne servono almeno 5.','zetten geanalyseerd; minstens 5 vereist.','ходов проанализировано; требуется не менее 5.','步已分析；至少需要 5 步。','手を分析済み。最低5手必要です。','수 분석됨; 최소 5수가 필요합니다.','hamle analiz edildi; en az 5 gerekli.','نقلة تم تحليلها؛ يلزم 5 على الأقل.','चालों का विश्लेषण; कम से कम 5 आवश्यक हैं।'],
  'posições…': ['positions…','posições…','posiciones…','positions…','Positionen…','posizioni…','posities…','позиций…','个局面…','局面…','포지션…','konum…','وضعيات…','स्थितियाँ…'],
  'fullscreen indisponível': ['fullscreen unavailable','fullscreen indisponível','pantalla completa no disponible','plein écran indisponible','Vollbild nicht verfügbar','schermo intero non disponibile','volledig scherm niet beschikbaar','полноэкранный режим недоступен','全屏不可用','全画面表示は利用できません','전체 화면을 사용할 수 없습니다','tam ekran kullanılamıyor','ملء الشاشة غير متاح','पूर्ण स्क्रीन उपलब्ध नहीं है'],
  'Primeiro lance': ['First move','Primeiro lance','Primera jugada','Premier coup','Erster Zug','Prima mossa','Eerste zet','Первый ход','第一步','最初の手','첫 수','İlk hamle','النقلة الأولى','पहली चाल'],
  'Último lance': ['Last move','Último lance','Última jugada','Dernier coup','Letzter Zug','Ultima mossa','Laatste zet','Последний ход','最后一步','最後の手','마지막 수','Son hamle','النقلة الأخيرة','आखिरी चाल']
});

let activeLanguage = 'en';
const textSources = new WeakMap();
const textRendered = new WeakMap();
const attributeSources = new WeakMap();
const attributeRendered = new WeakMap();
Object.assign(MESSAGES, {"Rating informado no PGN":["Rating from PGN","Rating informado no PGN","Rating del PGN","Classement du PGN","Rating aus PGN","Rating dal PGN","Rating uit PGN","Рейтинг из PGN","PGN 中的等级分","PGN のレーティング","PGN 레이팅","PGN derecesi","تصنيف PGN","PGN रेटिंग"],"Desempenho equivalente":["Performance equivalent","Desempenho equivalente","Rendimiento equivalente","Performance équivalente","Vergleichbare Spielstärke","Prestazione equivalente","Vergelijkbaar spelniveau","Эквивалентная сила","对应表现水平","相当する実力","환산 경기력","Eşdeğer performans","الأداء المكافئ","समकक्ष प्रदर्शन"],"Desempenho por área":["Performance by area","Desempenho por área","Rendimiento por área","Performance par domaine","Leistung nach Bereich","Prestazioni per area","Prestatie per onderdeel","Результаты по этапам","分项表现","分野別の成績","영역별 경기력","Bölümlere göre performans","الأداء حسب المرحلة","क्षेत्र के अनुसार प्रदर्शन"],"Abertura":["Opening","Abertura","Apertura","Ouverture","Eröffnung","Apertura","Opening","Дебют","开局","序盤","오프닝","Açılış","الافتتاح","ओपनिंग"],"Táticas":["Tactics","Táticas","Táctica","Tactique","Taktik","Tattica","Tactiek","Тактика","战术","戦術","전술","Taktikler","التكتيكات","रणनीति"],"Estratégia":["Strategy","Estratégia","Estrategia","Stratégie","Strategie","Strategia","Strategie","Стратегия","战略","戦略","전략","Strateji","الاستراتيجية","रणनीति"],"Final":["Endgame","Final","Final","Finale","Endspiel","Finale","Eindspel","Эндшпиль","残局","終盤","엔드게임","Oyun sonu","النهاية","एंडगेम"],"Chance perdida":["Missed opportunity","Chance perdida","Oportunidad perdida","Occasion manquée","Verpasste Chance","Occasione persa","Gemiste kans","Упущенный шанс","错失机会","逃したチャンス","놓친 기회","Kaçırılan fırsat","فرصة ضائعة","छूटा हुआ अवसर"],"Blitz":["Blitz","Blitz","Blitz","Blitz","Blitz","Blitz","Blitz","Блиц","快棋","ブリッツ","블리츠","Blitz","بليتز","ब्लिट्ज़"],"Rapid":["Rapid","Rápido","Rápidas","Rapide","Rapid","Rapide","Rapid","Рапид","快棋","ラピッド","래피드","Hızlı","سريع","रैपिड"],"Partida curta demais para estimar.":["Game too short to estimate.","Partida curta demais para estimar.","Partida demasiado corta para estimar.","Partie trop courte pour estimer.","Partie zu kurz für eine Schätzung.","Partita troppo breve per stimare.","Partij te kort om te schatten.","Партия слишком короткая для оценки.","对局太短，无法估算。","対局が短すぎるため推定できません。","게임이 너무 짧아 추정할 수 없습니다.","Tahmin için oyun çok kısa.","المباراة قصيرة جدًا للتقدير.","अनुमान के लिए खेल बहुत छोटा है।"],"Ritmo não informado no PGN.":["Time control is missing from the PGN.","Ritmo não informado no PGN.","El ritmo no está indicado en el PGN.","Le rythme n’est pas indiqué dans le PGN.","Die Bedenkzeit fehlt in der PGN.","Il ritmo non è indicato nel PGN.","Het speeltempo ontbreekt in de PGN.","Контроль времени не указан в PGN.","PGN 未提供用时信息。","PGN に持ち時間がありません。","PGN에 시간 제한 정보가 없습니다.","PGN içinde süre kontrolü yok.","الوقت غير مذكور في PGN.","PGN में समय नियंत्रण नहीं दिया गया है。"],"Precisão isolada não estima bem rating bullet.":["A single game cannot estimate bullet rating reliably.","Precisão isolada não estima bem rating bullet.","Una sola partida no estima bien el rating bullet.","Une seule partie ne permet pas d’estimer le classement bullet.","Eine einzelne Bullet-Partie erlaubt keine verlässliche Rating-Schätzung.","Una singola partita bullet non consente una stima affidabile.","Eén bulletpartij geeft geen betrouwbare ratinginschatting.","По одной пуле нельзя надёжно оценить рейтинг.","单局超快棋无法可靠估算等级分。","一局のブレットではレーティングを正確に推定できません。","불릿 한 판으로는 레이팅을 신뢰성 있게 추정할 수 없습니다.","Tek bir bullet oyunu güvenilir rating tahmini sağlamaz.","لا يمكن تقدير التصنيف في البلِتز السريع من مباراة واحدة.","एक बुलेट गेम से रेटिंग का विश्वसनीय अनुमान नहीं मिलता।"],"Sem curva de referência para partidas clássicas.":["No reference curve for classical games.","Sem curva de referência para partidas clássicas.","No hay una curva de referencia para partidas clásicas.","Aucune courbe de référence pour les parties classiques.","Keine Referenzkurve für klassische Partien.","Nessuna curva di riferimento per le partite classiche.","Geen referentiecurve voor klassieke partijen.","Нет эталонной кривой для классических партий.","古典棋没有可用的参考曲线。","クラシカル対局の基準曲線はありません。","클래식 경기의 기준 곡선이 없습니다.","Klasik oyunlar için referans eğrisi yok.","لا يوجد منحنى مرجعي للمباريات الكلاسيكية.","क्लासिकल खेलों के लिए संदर्भ वक्र उपलब्ध नहीं है।"],"Dados insuficientes para estimar.":["Not enough data to estimate.","Dados insuficientes para estimar.","No hay datos suficientes para estimar.","Données insuffisantes pour estimer.","Nicht genügend Daten für eine Schätzung.","Dati insufficienti per stimare.","Onvoldoende gegevens om te schatten.","Недостаточно данных для оценки.","数据不足，无法估算。","推定に必要なデータが足りません。","추정할 데이터가 부족합니다.","Tahmin için yeterli veri yok.","البيانات غير كافية للتقدير.","अनुमान के लिए पर्याप्त डेटा नहीं है।"],"Complete a revisão para ver o desempenho por área.":["Complete the review to see performance by area.","Complete a revisão para ver o desempenho por área.","Completa la revisión para ver el rendimiento por área.","Terminez l’analyse pour voir les performances par domaine.","Schließe die Analyse ab, um die Leistung nach Bereich zu sehen.","Completa la revisione per vedere le prestazioni per area.","Voltooi de analyse om prestaties per onderdeel te zien.","Завершите анализ, чтобы увидеть результаты по этапам.","完成复盘后即可查看各方面表现。","分析を完了すると分野別の成績が表示されます。","분석을 완료하면 영역별 경기력이 표시됩니다.","Bölümlere göre performansı görmek için analizi tamamlayın.","أكمل المراجعة لعرض الأداء حسب المرحلة.","क्षेत्र के अनुसार प्रदर्शन देखने के लिए समीक्षा पूरी करें।"],"Área":["Area","Área","Área","Domaine","Bereich","Area","Onderdeel","Раздел","项目","分野","영역","Alan","المرحلة","क्षेत्र"],"Sem dados":["No data","Sem dados","Sin datos","Aucune donnée","Keine Daten","Nessun dato","Geen gegevens","Нет данных","暂无数据","データなし","데이터 없음","Veri yok","لا توجد بيانات","कोई डेटा नहीं"],"oportunidades perdidas":["missed opportunities","oportunidades perdidas","oportunidades perdidas","occasions manquées","verpasste Chancen","occasioni perse","gemiste kansen","упущенные шансы","错失的机会","逃したチャンス","놓친 기회","kaçırılan fırsatlar","فرص ضائعة","छूटे हुए अवसर"],"Abertura não identificada nos dados do PGN.":["Opening not identified in the PGN.","Abertura não identificada nos dados do PGN.","Apertura no identificada en el PGN.","Ouverture non identifiée dans le PGN.","Eröffnung in der PGN nicht erkannt.","Apertura non identificata nel PGN.","Opening niet vermeld in de PGN.","Дебют не указан в PGN.","PGN 中未提供开局名称。","PGN にオープニング情報がありません。","PGN에 오프닝 정보가 없습니다.","PGN içinde açılış belirtilmemiş.","الافتتاح غير محدد في PGN.","PGN में ओपनिंग की जानकारी नहीं है।"],"Abertura: ":["Opening: ","Abertura: ","Apertura: ","Ouverture : ","Eröffnung: ","Apertura: ","Opening: ","Дебют: ","开局：","オープニング：","오프닝: ","Açılış: ","الافتتاح: ","ओपनिंग: "],"Táticas considera posições com capturas, xeques ou promoções nas principais linhas do motor. Estratégia considera lances tranquilos do meio-jogo.":["Tactics covers positions where engine main lines contain captures, checks, or promotions. Strategy covers quiet middlegame moves.","Táticas considera posições com capturas, xeques ou promoções nas principais linhas do motor. Estratégia considera lances tranquilos do meio-jogo.","Táctica incluye posiciones con capturas, jaques o promociones en las líneas principales del motor. Estrategia incluye jugadas tranquilas del medio juego.","La tactique couvre les positions où les variantes principales contiennent des captures, des échecs ou des promotions. La stratégie couvre les coups calmes du milieu de jeu.","Taktik umfasst Stellungen mit Schlägen, Schachgeboten oder Umwandlungen in den Hauptvarianten. Strategie umfasst ruhige Mittelspielzüge.","La tattica include posizioni con catture, scacchi o promozioni nelle linee principali del motore. La strategia include mosse tranquille del mediogioco.","Tactiek omvat stellingen met slagen, schaakzetten of promoties in de hoofdvarianten. Strategie omvat rustige zetten in het middenspel.","Тактика охватывает позиции со взятиями, шахами или превращениями в главных линиях движка. Стратегия охватывает спокойные ходы миттельшпиля.","战术统计引擎主要变化中的吃子、将军或升变局面。战略统计中局中的平静着法。","戦術はエンジンの主な変化に含まれる捕獲、チェック、昇格の局面です。戦略は中盤の静かな手を対象とします。","전술은 엔진 주요 수순의 포획, 체크, 승격이 포함된 포지션을 계산합니다. 전략은 미들게임의 조용한 수를 계산합니다.","Taktikler motorun ana varyantlarındaki taş alma, şah ve terfi konumlarını kapsar. Strateji, oyun ortasındaki sakin hamleleri kapsar.","تشمل التكتيكات المواقف التي تتضمن أخذ قطع أو كشًا أو ترقية في الخطوط الرئيسية للمحرك. وتشمل الاستراتيجية النقلات الهادئة في وسط اللعب.","रणनीति में इंजन की मुख्य लाइनों में कैप्चर, चेक या प्रमोशन वाली स्थितियाँ शामिल हैं। रणनीति मध्यखेल की शांत चालों को कवर करती है।"],"Rating informado e desempenho estimado":["Known rating and estimated performance","Rating informado e desempenho estimado","Rating registrado y rendimiento estimado","Classement indiqué et performance estimée","Angegebenes Rating und geschätzte Leistung","Rating indicato e prestazione stimata","Opgegeven rating en geschatte prestatie","Указанный рейтинг и оценка выступления","PGN 等级分与估算表现","記録されたレーティングと推定パフォーマンス","기록된 레이팅 및 추정 경기력","PGN derecesi ve tahmini performans","التصنيف المسجل والأداء التقديري","दर्ज रेटिंग और अनुमानित प्रदर्शन"],"Os dados de rating e desempenho aparecem após a revisão.":["Rating and performance details appear after the review.","Os dados de rating e desempenho aparecem após a revisão.","Los datos de rating y rendimiento aparecen después del análisis.","Les données de classement et de performance apparaissent après l’analyse.","Rating- und Leistungsdaten erscheinen nach der Analyse.","I dati sul rating e sulla prestazione appaiono dopo la revisione.","Rating- en prestatiegegevens verschijnen na de analyse.","Данные о рейтинге и выступлении появятся после анализа.","分析完成后会显示等级分和表现数据。","分析後にレーティングとパフォーマンスが表示されます。","분석 후 레이팅 및 경기력 정보가 표시됩니다.","Rating ve performans bilgileri analizden sonra görünür.","تظهر بيانات التصنيف والأداء بعد المراجعة.","समीक्षा के बाद रेटिंग और प्रदर्शन का विवरण दिखाई देगा।"],"O rating do PGN é o valor registrado na partida. O desempenho equivalente usa uma referência Lichess, não converte para Chess.com e não representa o rating real do jogador.":["The PGN rating is the value recorded for the game. Equivalent performance uses a Lichess reference; it is not a Chess.com conversion or the player's actual rating.","O rating do PGN é o valor registrado na partida. O desempenho equivalente usa uma referência Lichess, não converte para Chess.com e não representa o rating real do jogador.","El rating del PGN es el valor registrado en la partida. El rendimiento equivalente usa una referencia de Lichess; no es una conversión de Chess.com ni el rating real del jugador.","Le classement du PGN est la valeur enregistrée pour la partie. La performance équivalente utilise une référence Lichess ; ce n’est pas une conversion Chess.com ni le classement réel du joueur.","Das PGN-Rating ist der für die Partie angegebene Wert. Die vergleichbare Leistung nutzt eine Lichess-Referenz und ist weder eine Chess.com-Umrechnung noch das tatsächliche Rating des Spielers.","Il rating del PGN è il valore registrato nella partita. La prestazione equivalente usa un riferimento Lichess, non una conversione Chess.com né il rating reale del giocatore.","Het PGN-rating is de waarde die bij de partij is opgeslagen. De vergelijkbare prestatie gebruikt een Lichess-referentie en is geen Chess.com-omrekening of de echte rating van de speler.","Рейтинг PGN — это значение, указанное для партии. Эквивалентное выступление основано на данных Lichess и не является рейтингом Chess.com или реальным рейтингом игрока.","PGN 等级分是本局记录的数值。等效表现参考 Lichess 数据，并非 Chess.com 换算值，也不代表棋手的真实等级分。","PGN のレーティングは対局に記録された値です。同等パフォーマンスは Lichess の基準を使用し、Chess.com への換算値でも実際のレーティングでもありません。","PGN 레이팅은 해당 대국에 기록된 값입니다. 환산 경기력은 Lichess 기준을 사용하며 Chess.com 환산값이나 실제 레이팅이 아닙니다.","PGN derecesi, oyunda kaydedilen değerdir. Eşdeğer performans Lichess referansı kullanır; Chess.com dönüşümü veya oyuncunun gerçek ratingi değildir.","تصنيف PGN هو القيمة المسجلة للمباراة. يعتمد الأداء المكافئ على مرجع Lichess، ولا يمثل تحويلًا إلى Chess.com أو التصنيف الحقيقي للاعب.","PGN रेटिंग खेल में दर्ज मान है। समकक्ष प्रदर्शन Lichess संदर्भ का उपयोग करता है; यह Chess.com रूपांतरण या खिलाड़ी की वास्तविक रेटिंग नहीं है।"],"A revisão mostrará abertura, táticas, estratégia e final.":["The review will show the opening, tactics, strategy, and endgame.","A revisão mostrará abertura, táticas, estratégia e final.","El análisis mostrará la apertura, táctica, estrategia y final.","L’analyse présentera l’ouverture, la tactique, la stratégie et la finale.","Die Analyse zeigt Eröffnung, Taktik, Strategie und Endspiel.","La revisione mostrerà apertura, tattica, strategia e finale.","De analyse toont de opening, tactiek, strategie en het eindspel.","В анализе будут показаны дебют, тактика, стратегия и эндшпиль.","复盘将展示开局、战术、战略和残局。","分析では序盤、戦術、戦略、終盤が表示されます。","분석에서 오프닝, 전술, 전략, 엔드게임을 확인할 수 있습니다.","Analiz açılış, taktik, strateji ve oyun sonunu gösterecek.","ستعرض المراجعة الافتتاح والتكتيك والاستراتيجية والنهاية.","समीक्षा में ओपनिंग, रणनीति, रणनीति और एंडगेम दिखेंगे।"],"Faixa indicativa: ":["Indicative range: ","Faixa indicativa: ","Rango orientativo: ","Fourchette indicative : ","Ungefährer Bereich: ","Intervallo indicativo: ","Indicatieve bandbreedte: ","Ориентировочный диапазон: ","参考范围：","目安の範囲：","대략적인 범위: ","Yaklaşık aralık: ","النطاق التقريبي: ","अनुमानित सीमा: "],"Precisão média por lance: ":["Average move accuracy: ","Precisão média por lance: ","Precisión media por jugada: ","Précision moyenne par coup : ","Durchschnittliche Genauigkeit pro Zug: ","Precisione media per mossa: ","Gemiddelde nauwkeurigheid per zet: ","Средняя точность за ход: ","平均每步准确率：","1手あたりの平均精度：","평균 수 정확도: ","Hamle başına ortalama doğruluk: ","متوسط الدقة لكل نقلة: ","प्रति चाल औसत सटीकता: "]," lances":[" moves"," lances"," jugadas"," coups"," Züge"," mosse"," zetten"," ходов"," 步"," 手"," 수"," hamle"," نقلات"," चाल"],"Precisão fora da faixa de referência; uma partida não permite estimar com segurança.":["Accuracy is outside the reference range; one game is not enough for a reliable estimate.","Precisão fora da faixa de referência; uma partida não permite estimar com segurança.","La precisión está fuera del rango de referencia; una sola partida no permite estimarlo con seguridad.","La précision est hors de la plage de référence ; une seule partie ne permet pas une estimation fiable.","Die Genauigkeit liegt außerhalb des Referenzbereichs; eine Partie reicht für eine sichere Schätzung nicht aus.","La precisione è fuori dall'intervallo di riferimento; una sola partita non consente una stima affidabile.","De nauwkeurigheid valt buiten het referentiebereik; één partij is onvoldoende voor een betrouwbare schatting.","Точность вне эталонного диапазона; одной партии недостаточно для надёжной оценки.","准确率超出参考范围；仅凭一局无法可靠估算。","精度が基準範囲外です。一局だけでは信頼できる推定はできません。","정확도가 기준 범위를 벗어났습니다. 한 판만으로는 신뢰할 수 있는 추정이 어렵습니다.","Doğruluk referans aralığının dışında; tek bir oyun güvenilir tahmin için yeterli değil.","الدقة خارج النطاق المرجعي؛ لا تكفي مباراة واحدة لتقدير موثوق.","सटीकता संदर्भ सीमा से बाहर है; एक खेल से विश्वसनीय अनुमान संभव नहीं है।"]});

Object.assign(MESSAGES, {
"Profile & language": ["Profile & language","Perfil e idioma","Perfil e idioma","Profil et langue","Profil & Sprache","Profilo e lingua","Profiel en taal","Профиль и язык","个人资料与语言","プロフィールと言語","프로필 및 언어","Profil ve dil","الملف الشخصي واللغة","प्रोफ़ाइल और भाषा"],
  "Your chess profile": ["Your chess profile","Seu perfil de xadrez","Tu perfil de ajedrez","Votre profil d’échecs","Dein Schachprofil","Il tuo profilo scacchistico","Je schaakprofiel","Ваш шахматный профиль","你的国际象棋资料","チェスプロフィール","체스 프로필","Satranç profiliniz","ملفك الشخصي للشطرنج","आपकी शतरंज प्रोफ़ाइल"],
  "Main chess platform": ["Main chess platform","Plataforma principal de xadrez","Plataforma principal de ajedrez","Plateforme d’échecs principale","Hauptplattform für Schach","Piattaforma scacchistica principale","Belangrijkste schaakplatform","Основная шахматная платформа","主要国际象棋平台","メインのチェスプラットフォーム","주요 체스 플랫폼","Ana satranç platformu","منصة الشطرنج الرئيسية","मुख्य शतरंज प्लेटफ़ॉर्म"],
  "No account / skip": ["No account / skip","Não tenho conta / pular","No tengo cuenta / omitir","Pas de compte / ignorer","Kein Konto / überspringen","Nessun account / salta","Geen account / overslaan","Нет аккаунта / пропустить","没有账号 / 跳过","アカウントなし / スキップ","계정 없음 / 건너뛰기","Hesabım yok / geç","ليس لدي حساب / تخطي","कोई खाता नहीं / छोड़ें"],
  "FIDE (FIDE ID)": ["FIDE (FIDE ID)","FIDE (ID FIDE)","FIDE (ID FIDE)","FIDE (identifiant FIDE)","FIDE (FIDE-ID)","FIDE (ID FIDE)","FIDE (FIDE-ID)","ФИДЕ (ID FIDE)","FIDE（FIDE ID）","FIDE（FIDE ID）","FIDE (FIDE ID)","FIDE (FIDE kimliği)","FIDE (معرّف FIDE)","FIDE (FIDE ID)"],
  "Other platform": ["Other platform","Outra plataforma","Otra plataforma","Autre plateforme","Andere Plattform","Altra piattaforma","Ander platform","Другая платформа","其他平台","その他のプラットフォーム","다른 플랫폼","Diğer platform","منصة أخرى","अन्य प्लेटफ़ॉर्म"],
  "Nickname or FIDE ID": ["Nickname or FIDE ID","Nickname ou ID FIDE","Nombre de usuario o ID FIDE","Pseudo ou identifiant FIDE","Benutzername oder FIDE-ID","Nome utente o ID FIDE","Gebruikersnaam of FIDE-ID","Никнейм или ID FIDE","昵称或 FIDE ID","ニックネームまたはFIDE ID","닉네임 또는 FIDE ID","Takma ad veya FIDE kimliği","الاسم المستعار أو معرّف FIDE","उपनाम या FIDE ID"],
  "Your nickname or FIDE ID (optional)": ["Your nickname or FIDE ID (optional)","Seu nickname ou ID FIDE (opcional)","Tu nombre de usuario o ID FIDE (opcional)","Votre pseudo ou identifiant FIDE (facultatif)","Dein Benutzername oder deine FIDE-ID (optional)","Il tuo nome utente o ID FIDE (facoltativo)","Je gebruikersnaam of FIDE-ID (optioneel)","Ваш никнейм или ID FIDE (необязательно)","你的昵称或 FIDE ID（可选）","ニックネームまたはFIDE ID（任意）","닉네임 또는 FIDE ID (선택 사항)","Takma adınız veya FIDE kimliğiniz (isteğe bağlı)","اسمك المستعار أو معرّف FIDE (اختياري)","आपका उपनाम या FIDE ID (वैकल्पिक)"],
  "Chess.com and Lichess nicknames will be filled in automatically when you search for games. FIDE ID is saved to your local profile.": ["Chess.com and Lichess nicknames will be filled in automatically when you search for games. FIDE ID is saved to your local profile.","Os nicknames do Chess.com e do Lichess serão preenchidos automaticamente ao buscar partidas. O ID FIDE ficará salvo no seu perfil local.","Los nombres de Chess.com y Lichess se completarán automáticamente al buscar partidas. El ID FIDE se guardará en tu perfil local.","Les pseudos Chess.com et Lichess seront remplis automatiquement lors de la recherche de parties. L’identifiant FIDE sera enregistré dans votre profil local.","Chess.com- und Lichess-Benutzernamen werden bei der Partiensuche automatisch eingetragen. Die FIDE-ID wird lokal in deinem Profil gespeichert.","I nomi utente di Chess.com e Lichess verranno inseriti automaticamente quando cerchi partite. L'ID FIDE sarà salvato nel tuo profilo locale.","Chess.com- en Lichess-gebruikersnamen worden automatisch ingevuld wanneer je partijen zoekt. Je FIDE-ID wordt lokaal opgeslagen.","Никнеймы Chess.com и Lichess будут автоматически подставляться при поиске партий. ID FIDE сохранится в локальном профиле.","搜索棋局时会自动填入 Chess.com 和 Lichess 用户名。FIDE ID 将保存在本地个人资料中。","棋譜を検索するとChess.comとLichessのユーザー名が自動入力されます。FIDE IDはこのブラウザーのプロフィールに保存されます。","게임을 검색할 때 Chess.com 및 Lichess 닉네임이 자동 입력됩니다. FIDE ID는 이 브라우저의 프로필에 저장됩니다.","Oyun ararken Chess.com ve Lichess kullanıcı adları otomatik doldurulur. FIDE kimliği yerel profilinizde saklanır.","سيتم إدخال أسماء Chess.com وLichess تلقائيًا عند البحث عن المباريات. سيُحفظ معرّف FIDE في ملفك الشخصي المحلي.","गेम खोजते समय Chess.com और Lichess उपनाम अपने आप भर जाएंगे। FIDE ID आपकी स्थानीय प्रोफ़ाइल में सहेजी जाएगी।"],
  "Your profile is stored only in this browser. You can edit it later from Profile & language.": ["Your profile is stored only in this browser. You can edit it later from Profile & language.","Seu perfil fica salvo somente neste navegador. Você poderá editá-lo depois em Perfil e idioma.","Tu perfil solo se guarda en este navegador. Podrás editarlo más tarde en Perfil e idioma.","Votre profil est enregistré uniquement dans ce navigateur. Vous pourrez le modifier plus tard dans Profil et langue.","Dein Profil wird nur in diesem Browser gespeichert. Du kannst es später unter Profil & Sprache bearbeiten.","Il tuo profilo viene salvato solo in questo browser. Potrai modificarlo in seguito da Profilo e lingua.","Je profiel wordt alleen in deze browser opgeslagen. Je kunt het later wijzigen via Profiel en taal.","Ваш профиль хранится только в этом браузере. Позже его можно изменить в разделе «Профиль и язык».","你的个人资料仅保存在此浏览器中。之后可在“个人资料与语言”中修改。","プロフィールはこのブラウザーにのみ保存されます。後から「プロフィールと言語」で編集できます。","프로필은 이 브라우저에만 저장됩니다. 나중에 프로필 및 언어에서 수정할 수 있습니다.","Profiliniz yalnızca bu tarayıcıda saklanır. Daha sonra Profil ve dil bölümünden düzenleyebilirsiniz.","يُحفظ ملفك الشخصي في هذا المتصفح فقط. يمكنك تعديله لاحقًا من قسم الملف الشخصي واللغة.","आपकी प्रोफ़ाइल केवल इसी ब्राउज़र में सहेजी जाती है। आप बाद में प्रोफ़ाइल और भाषा से इसे संपादित कर सकते हैं।"]
});

const trackedAttributes = ['title', 'aria-label', 'aria-description', 'placeholder', 'alt', 'content'];


Object.assign(MESSAGES, {
  'Desempenho equivalente estimado': ['Estimated game performance','Desempenho equivalente estimado','Rendimiento equivalente estimado','Performance équivalente estimée','Geschätzte Spielleistung','Prestazione equivalente stimata','Geschatte gelijkwaardige prestatie','Оценка результата партии','估算对局表现','推定パフォーマンス','추정 경기 퍼포먼스','Tahmini oyun performansı','الأداء التقديري للمباراة','अनुमानित खेल प्रदर्शन'],
  'Faixa indicativa': ['Indicative range','Faixa indicativa','Rango orientativo','Fourchette indicative','Orientierungsbereich','Intervallo indicativo','Indicatieve bandbreedte','Ориентировочный диапазон','参考范围','参考範囲','참고 범위','Yaklaşık aralık','النطاق التقريبي','अनुमानित सीमा'],
  'lances analisados': ['moves analyzed','lances analisados','jugadas analizadas','coups analysés','analysierte Züge','mosse analizzate','zetten geanalyseerd','ходов проанализировано','已分析着法','解析した手','분석된 수','analiz edilen hamle','نقلة تم تحليلها','चालों का विश्लेषण किया गया'],
  'Erro médio absoluto no teste histórico': ['Historical test mean absolute error','Erro médio absoluto no teste histórico','Error absoluto medio en la prueba histórica','Erreur absolue moyenne sur le test historique','Mittlerer absoluter Fehler im historischen Test','Errore assoluto medio nel test storico','Gemiddelde absolute fout op de historische test','Средняя абсолютная ошибка на историческом тесте','历史测试平均绝对误差','過去のテストにおける平均絶対誤差','과거 테스트 평균 절대 오차','Geçmiş testte ortalama mutlak hata','متوسط الخطأ المطلق في الاختبار التاريخي','ऐतिहासिक परीक्षण में औसत निरपेक्ष त्रुटि'],
  'Sem situação relevante para avaliar': ['No relevant situation to evaluate','Sem situação relevante para avaliar','No hay una situación relevante para evaluar','Aucune situation pertinente à évaluer','Keine relevante Situation zu bewerten','Nessuna situazione rilevante da valutare','Geen relevante situatie om te beoordelen','Нет подходящей ситуации для оценки','没有相关局面可评估','評価できる関連局面がありません','평가할 관련 상황이 없습니다','Değerlendirilecek ilgili durum yok','لا توجد حالة ذات صلة للتقييم','मूल्यांकन के लिए कोई प्रासंगिक स्थिति नहीं'],
  'As notas usam as classificações dos lances relevantes; áreas sem amostra não recebem nota.': ['Grades use classifications of relevant moves; areas without a sample are not graded.','As notas usam as classificações dos lances relevantes; áreas sem amostra não recebem nota.','Las notas usan las clasificaciones de las jugadas relevantes; las áreas sin muestra no reciben nota.','Les notes utilisent les classifications des coups pertinents ; les domaines sans échantillon ne sont pas notés.','Die Noten basieren auf den Klassifizierungen relevanter Züge; Bereiche ohne Stichprobe werden nicht bewertet.','I voti usano le classificazioni delle mosse pertinenti; le aree senza campione non ricevono un voto.','Scores gebruiken de classificaties van relevante zetten; gebieden zonder steekproef krijgen geen score.','Оценки основаны на классификации значимых ходов; области без выборки не оцениваются.','评分根据相关着法的分类计算；没有样本的类别不评分。','評価は関連する手の分類を使用し、サンプルのない分野は評価しません。','평가는 관련 수의 분류를 사용하며 표본이 없는 영역은 점수를 매기지 않습니다.','Notlar ilgili hamlelerin sınıflandırmalarını kullanır; örnek bulunmayan alanlar puanlanmaz.','تستخدم الدرجات تصنيفات النقلات ذات الصلة؛ ولا تُقيَّم المجالات التي لا تحتوي على عينة.','अंक प्रासंगिक चालों के वर्गीकरण पर आधारित हैं; नमूना न होने वाले क्षेत्रों को अंक नहीं दिए जाते।'],
  'Análise da variante exploratória': ['Exploratory variation analysis','Análise da variante exploratória','Análisis de la variante exploratoria','Analyse de la variante exploratoire','Analyse der Erkundungsvariante','Analisi della variante esplorativa','Analyse van de verkennende variant','Анализ исследовательского варианта','探索变例分析','探索変化の分析','탐색 변형 분석','Keşif varyantı analizi','تحليل التفرع الاستكشافي','अन्वेषणात्मक वैरिएशन विश्लेषण'],
  'Melhor alternativa': ['Best alternative','Melhor alternativa','Mejor alternativa','Meilleure alternative','Beste Alternative','Migliore alternativa','Beste alternatief','Лучшая альтернатива','最佳选择','最善の代替手','최선의 대안','En iyi alternatif','أفضل بديل','सर्वश्रेष्ठ विकल्प'],
  'Sua jogada': ['Your move','Sua jogada','Tu jugada','Votre coup','Dein Zug','La tua mossa','Jouw zet','Ваш ход','你的着法','あなたの手','내 수','Senin hamlen','نقلتك','आपकी चाल'],
  'Variação da avaliação para quem jogou': ['Evaluation change for the player to move','Variação da avaliação para quem jogou','Cambio de evaluación para quien jugó','Variation de l’évaluation pour le joueur','Bewertungsänderung für den Spieler am Zug','Variazione della valutazione per chi ha mosso','Evaluatieverandering voor de speler die aan zet was','Изменение оценки для сделавшего ход','当前行棋方的评估变化','手番側から見た評価の変化','착수한 쪽 기준 평가 변화','Hamleyi yapan taraf için değerlendirme farkı','تغير التقييم للاعب الذي تحرك','चाल चलने वाले खिलाड़ी के लिए मूल्यांकन परिवर्तन']
});
Object.assign(MESSAGES, {
  "Resumo da partida": [
    "Game summary",
    "Resumo da partida",
    "Resumen de la partida",
    "Résumé de la partie",
    "Partieübersicht",
    "Riepilogo della partita",
    "Partijoverzicht",
    "Итоги партии",
    "对局摘要",
    "対局の概要",
    "경기 요약",
    "Oyun özeti",
    "ملخص المباراة",
    "खेल का सारांश"
  ],
  "Jogadores": [
    "Players",
    "Jogadores",
    "Jugadores",
    "Joueurs",
    "Spieler",
    "Giocatori",
    "Spelers",
    "Игроки",
    "棋手",
    "プレイヤー",
    "선수",
    "Oyuncular",
    "اللاعبون",
    "खिलाड़ी"
  ],
  "Precisão": [
    "Accuracy",
    "Precisão",
    "Precisión",
    "Précision",
    "Genauigkeit",
    "Precisione",
    "Nauwkeurigheid",
    "Точность",
    "准确率",
    "精度",
    "정확도",
    "Doğruluk",
    "الدقة",
    "सटीकता"
  ],
  "Rating da partida": [
    "Game rating",
    "Rating da partida",
    "Rating de la partida",
    "Performance de la partie",
    "Partieleistung",
    "Rating della partita",
    "Partijrating",
    "Рейтинг партии",
    "对局表现分",
    "対局レーティング",
    "경기 레이팅",
    "Oyun derecesi",
    "تصنيف المباراة",
    "खेल की रेटिंग"
  ],
  "Rating do PGN": [
    "PGN rating",
    "Rating do PGN",
    "Rating del PGN",
    "Classement du PGN",
    "PGN-Rating",
    "Rating del PGN",
    "PGN-rating",
    "Рейтинг из PGN",
    "PGN 等级分",
    "PGN レーティング",
    "PGN 레이팅",
    "PGN derecesi",
    "تصنيف PGN",
    "PGN रेटिंग"
  ],
  "Detalhes da estimativa": [
    "Estimate details",
    "Detalhes da estimativa",
    "Detalles de la estimación",
    "Détails de l’estimation",
    "Details zur Schätzung",
    "Dettagli della stima",
    "Details van de schatting",
    "Детали оценки",
    "估算详情",
    "推定の詳細",
    "추정 세부 정보",
    "Tahmin ayrıntıları",
    "تفاصيل التقدير",
    "अनुमान का विवरण"
  ],
  "Gráfico da avaliação ao longo da partida. Use as setas para navegar pelos lances.": [
    "Evaluation chart. Use the arrow keys to navigate the moves.",
    "Gráfico da avaliação ao longo da partida. Use as setas para navegar pelos lances.",
    "Gráfico de evaluación. Usa las flechas para recorrer las jugadas.",
    "Graphique d’évaluation. Utilisez les flèches pour parcourir les coups.",
    "Bewertungsdiagramm. Mit den Pfeiltasten durch die Züge navigieren.",
    "Grafico della valutazione. Usa le frecce per scorrere le mosse.",
    "Evaluatiegrafiek. Gebruik de pijltoetsen om door de zetten te gaan.",
    "График оценки. Используйте стрелки для перехода между ходами.",
    "评估曲线。用方向键浏览着法。",
    "評価グラフ。矢印キーで指し手を移動します。",
    "평가 그래프. 화살표 키로 수를 탐색합니다.",
    "Değerlendirme grafiği. Hamleler arasında ok tuşlarıyla gezinin.",
    "مخطط التقييم. استخدم مفاتيح الأسهم للتنقل بين النقلات.",
    "मूल्यांकन ग्राफ़। चालों के बीच जाने के लिए तीर कुंजियाँ दबाएँ।"
  ],
  "Poucas decisões úteis para estimar.": [
    "Too few informative moves to estimate.",
    "Poucas decisões úteis para estimar."
  ],
  "Origem da partida não identificada no PGN.": [
    "Game platform unavailable in the PGN.",
    "Origem da partida não identificada no PGN."
  ],
  "O PGN não informa um rating válido.": [
    "The PGN has no usable player rating.",
    "O PGN não informa um rating válido."
  ],
  "Estimativa indisponível no bullet.": [
    "Estimate unavailable for bullet.",
    "Estimativa indisponível no bullet."
  ],
  "Estimativa indisponível no clássico.": [
    "Estimate unavailable for classical.",
    "Estimativa indisponível no clássico."
  ],
  "Escala: ": [
    "Rating scale: ",
    "Escala: "
  ]
});

Object.assign(MESSAGES, {
  "Detalhes do lance": [
    "Move details",
    "Detalhes do lance"
  ],
  "Ver melhor lance": [
    "See best move",
    "Ver melhor lance",
    "Ver mejor jugada",
    "Voir le meilleur coup",
    "Besten Zug ansehen",
    "Vedi la mossa migliore",
    "Beste zet bekijken",
    "Показать лучший ход",
    "查看最佳着法",
    "最善手を見る",
    "최선의 수 보기",
    "En iyi hamleyi gör",
    "عرض أفضل نقلة",
    "सबसे अच्छी चाल देखें"
  ],
  "Próxima oportunidade": [
    "Next missed chance",
    "Próxima oportunidade",
    "Siguiente oportunidad",
    "Occasion suivante",
    "Nächste verpasste Chance",
    "Prossima opportunità",
    "Volgende gemiste kans",
    "Следующая возможность",
    "下一次错失机会",
    "次のチャンス",
    "다음 놓친 기회",
    "Sonraki fırsat",
    "الفرصة التالية",
    "अगला मौका"
  ],
  "Comparar linhas": [
    "Compare lines",
    "Comparar linhas",
    "Comparar líneas",
    "Comparer les variantes",
    "Varianten vergleichen",
    "Confronta le varianti",
    "Varianten vergelijken",
    "Сравнить варианты",
    "比较变化",
    "変化を比較",
    "변화 비교",
    "Varyantları karşılaştır",
    "مقارنة الخطوط",
    "चाल-क्रमों की तुलना"
  ],
  "Havia mate em ": [
    "There was mate in ",
    "Havia mate em "
  ],
  "Havia mate forçado em ": [
    "There was a forced mate in ",
    "Havia mate forçado em "
  ],
  "Depois do lance, o motor aponta mate em ": [
    "After the move, the engine finds mate in ",
    "Depois do lance, o motor aponta mate em "
  ],
  "abria um ataque descoberto sobre a dama em ": [
    "opened a discovered attack on the queen on ",
    "abria um ataque descoberto sobre a dama em "
  ]
});

Object.assign(MESSAGES, {
  "Começar revisão": [
    "Start review",
    "Começar revisão",
    "Empezar revisión",
    "Commencer la revue",
    "Analyse starten",
    "Avvia revisione",
    "Analyse starten",
    "Начать разбор",
    "开始复盘",
    "振り返りを始める",
    "리뷰 시작",
    "İncelemeyi başlat",
    "ابدأ المراجعة",
    "समीक्षा शुरू करें"
  ],
  "Ver resumo": [
    "See summary",
    "Ver resumo",
    "Ver resumen",
    "Voir le résumé",
    "Übersicht ansehen",
    "Vedi riepilogo",
    "Bekijk overzicht",
    "Показать сводку",
    "查看摘要",
    "概要を見る",
    "요약 보기",
    "Özeti gör",
    "عرض الملخص",
    "सारांश देखें"
  ],
  "Próximo destaque": [
    "Next highlight",
    "Próximo destaque",
    "Siguiente momento",
    "Moment suivant",
    "Nächster Schlüsselmoment",
    "Prossimo momento",
    "Volgende moment",
    "Следующий момент",
    "下一个关键着法",
    "次のポイント",
    "다음 주요 수",
    "Sonraki kritik hamle",
    "اللحظة التالية",
    "अगला अहम क्षण"
  ],
  "Voltar ao lance": [
    "Back to move",
    "Voltar ao lance"
  ],
  "A explicação aparece quando esta posição for revisada.": [
    "The explanation appears once this position is reviewed.",
    "A explicação aparece quando esta posição for revisada."
  ],
  "Selecione um lance no histórico ou no gráfico.": [
    "Select a move in the list or chart.",
    "Selecione um lance no histórico ou no gráfico."
  ],
  "Explicar": [
    "Explain",
    "Explicar"
  ]
});

MESSAGES['No tabuleiro: '] = ['On the board: ', 'No tabuleiro: '];

function languageIndex() {
  const index = CODES.indexOf(activeLanguage);
  return index < 0 ? 0 : index;
}

export function translate(value) {
  if (typeof value !== 'string' || !value) return value;
  const index = languageIndex();
  const trimmed = value.trim();
  if (!trimmed) return value;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const exact = MESSAGES[trimmed];
  if (exact) return leading + (exact[index] || exact[0]) + trailing;

  let output = value;
  const keys = Object.keys(MESSAGES).filter(key => key.length > 3).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (!output.includes(key)) continue;
    const replacement = MESSAGES[key][index] || MESSAGES[key][0];
    output = output.split(key).join(replacement);
  }
  return output;
}

function applyNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const current = node.nodeValue ?? '';
    if (!textSources.has(node) || textRendered.get(node) !== current) textSources.set(node, current);
    const next = translate(textSources.get(node));
    if (next !== current) {
      node.nodeValue = next;
      textRendered.set(node, next);
    } else {
      textRendered.set(node, current);
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;

  if (node.nodeType === Node.ELEMENT_NODE) {
    let sources = attributeSources.get(node);
    if (!sources) {
      sources = new Map();
      attributeSources.set(node, sources);
    }
    let rendered = attributeRendered.get(node);
    if (!rendered) {
      rendered = new Map();
      attributeRendered.set(node, rendered);
    }
    for (const name of trackedAttributes) {
      if (!node.hasAttribute(name)) continue;
      const current = node.getAttribute(name);
      if (!sources.has(name) || rendered.get(name) !== current) sources.set(name, current);
      const next = translate(sources.get(name));
      if (next !== current) node.setAttribute(name, next);
      rendered.set(name, next);
    }
  }
  for (const child of node.childNodes) applyNode(child);
}

let observer;

export function setLanguage(code) {
  activeLanguage = CODES.includes(code) ? code : 'en';
  document.documentElement.lang = activeLanguage;
  document.documentElement.dir = activeLanguage === 'ar' ? 'rtl' : 'ltr';
  try { localStorage.setItem('move-by-move/language', activeLanguage); } catch { /* Storage is optional. */ }
  document.title = translate('Move by Move — Chess Analysis');
  applyNode(document.documentElement);
  return activeLanguage;
}

export function getLanguage() {
  return activeLanguage;
}

export function hasSavedLanguage() {
  try { return CODES.includes(localStorage.getItem('move-by-move/language')); } catch { return false; }
}

export function initLanguage() {
  let saved = null;
  try { saved = localStorage.getItem('move-by-move/language'); } catch { /* Storage is optional. */ }
  activeLanguage = CODES.includes(saved) ? saved : 'en';
  document.documentElement.lang = activeLanguage;
  document.documentElement.dir = activeLanguage === 'ar' ? 'rtl' : 'ltr';
  document.title = translate('Move by Move — Chess Analysis');
  applyNode(document.documentElement);
  if (!observer) {
    observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') applyNode(record.target);
        for (const node of record.addedNodes ?? []) applyNode(node);
        if (record.type === 'attributes') applyNode(record.target);
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: trackedAttributes });
  }
  return { language: activeLanguage, saved: Boolean(saved && CODES.includes(saved)) };
}

export function languageOptions() {
  return LANGUAGES.map(language => ({ ...language }));
}
