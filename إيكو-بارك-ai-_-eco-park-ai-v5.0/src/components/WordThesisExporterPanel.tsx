import React, { useState } from 'react';
import { BookOpen, CheckCircle2, FileText, Download } from 'lucide-react';
import { ActiveMergedEventState, ActiveMergedTourState, Language } from '../types/parking';
import { t } from '../data/i18n';

interface WordThesisExporterPanelProps {
  lang: Language;
  totalSpots: number;
  reservationsCount: number;
  totalCo2Kg: number;
  bessCharge: number;
  solarKw: number;
  activeMergedTour?: ActiveMergedTourState | null;
  activeMergedEvent?: ActiveMergedEventState | null;
  onNotify: (msg: string) => void;
}

export const WordThesisExporterPanel: React.FC<WordThesisExporterPanelProps> = ({
  lang,
  totalSpots,
  reservationsCount,
  totalCo2Kg,
  bessCharge,
  solarKw,
  activeMergedTour = null,
  activeMergedEvent = null,
  onNotify,
}) => {
  const [docTitle, setDocTitle] = useState(
    'المنظومة الثلاثية الموحدة: إيكو-بارك AI المدمجة مع مشروع 101 (المسارات السياحية الذكية) ومشروع 107 (إدارة الفعاليات وترشيد الموارد)'
  );
  const [authorName, setAuthorName] = useState('فريق تطوير منظومة إيكو-بارك AI الموحدة');
  const [institution, setInstitution] = useState(
    'كلية الهندسة وتقنية المعلومات — قسم النظم الذكية والاستدامة'
  );
  const [exportedOnce, setExportedOnce] = useState(false);

  const handleDownloadWord10Pages = () => {
    const today = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${docTitle}</title>
<style>
  @page {
    size: A4;
    margin: 2.3cm 2.2cm 2.3cm 2.2cm;
  }
  body {
    font-family: "Cairo", "Simplified Arabic", "Arial", sans-serif;
    font-size: 13.5pt;
    line-height: 1.75;
    color: #111827;
    direction: rtl;
    text-align: justify;
  }
  h1 {
    font-size: 19pt;
    color: #065F46;
    border-bottom: 2px solid #10B981;
    padding-bottom: 6pt;
    margin-top: 0;
  }
  h2 {
    font-size: 15pt;
    color: #047857;
    margin-top: 14pt;
    margin-bottom: 6pt;
  }
  h3 {
    font-size: 13.5pt;
    color: #0F172A;
    margin-top: 10pt;
    margin-bottom: 4pt;
  }
  p, li {
    font-size: 13pt;
    margin-bottom: 7pt;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
    font-size: 11.5pt;
  }
  th, td {
    border: 1px solid #94A3B8;
    padding: 7pt 8pt;
    text-align: right;
    vertical-align: top;
  }
  th {
    background-color: #ECFDF5;
    color: #065F46;
    font-weight: bold;
  }
  .cover {
    text-align: center;
    padding-top: 32pt;
  }
  .cover-box {
    border: 2px solid #10B981;
    background-color: #F0FDF4;
    padding: 18pt;
    margin: 18pt 0;
  }
  .kpi-note {
    background-color: #F8FAFC;
    border-right: 4px solid #0284C7;
    padding: 10pt 12pt;
    margin: 10pt 0;
    font-size: 12pt;
  }
  .page-break {
    page-break-before: always;
    mso-break-type: page-break;
  }
  .page-tag {
    font-size: 10pt;
    color: #64748B;
    text-align: left;
    border-top: 1px dashed #CBD5E1;
    padding-top: 4pt;
    margin-top: 18pt;
  }
</style>
</head>
<body>

<!-- ==================== PAGE 1 ==================== -->
<div class="cover">
  <p style="font-size:13.5pt;color:#047857;font-weight:bold;">وثيقة المشروع الموحد (10 صفحات منسقة) — دمج الأنظمة الذكية للمدن المستدامة</p>
  <h1 style="border:none;font-size:21pt;color:#064E3B;margin-top:16pt;">${docTitle}</h1>
  <p style="font-size:13pt;color:#334155;">تكامل المواقف الذكية والطاقة الشمسية (Eco-Park AI) مع منصة تخطيط الرحلات واستكشاف المدن (مشروع 101) ومنصة إدارة الفعاليات والتنبؤ بالحضور وترشيد الموارد (مشروع 107)</p>

  <div class="cover-box">
    <p><strong>إعداد:</strong> ${authorName}</p>
    <p><strong>الجهة الأكاديمية / التنظيمية:</strong> ${institution}</p>
    <p><strong>المشاريع المدمجة:</strong> Eco-Park AI v5.0 + مشروع رقم (101) + مشروع رقم (107)</p>
    <p><strong>تاريخ الإصدار:</strong> ${today}</p>
  </div>
</div>

<h2>الملخص التنفيذي للدمج الثلاثي</h2>
<p>تقدم هذه الوثيقة التأسيس الهندسي والتشغيلي الكامل للمنصة الموحدة التي تدمج في نسيج واحد بين <strong>منظومة إيكو-بارك AI للمواقف الذكية والطاقة الشمسية والبيئة الخضراء</strong>، وبين <strong>مشروع رقم (101): تخطيط الرحلات والمسارات السياحية الذكية</strong> المدمج مباشرة داخل منظومة الحجوزات، و<strong>مشروع رقم (107): إدارة الفعاليات والتنبؤ بمعدلات الحضور وترشيد الموارد</strong> المدمج مباشرة داخل محرك التوقعات والطاقة مع رصد تلقائي لتعارض أوقات الفعاليات مع مخزون بطاريات BESS.</p>

<h2>فهرس المحتويات (10 صفحات)</h2>
<ul>
  <li>الصفحة 1: صفحة الغلاف، الملخص التنفيذي، وفهرس المحتويات.</li>
  <li>الصفحة 2: المقدمة التمهيدية وتكامل ثلاثي الاستدامة والمدن الذكية.</li>
  <li>الصفحة 3: منهجية دمج مشروع (101) ومشروع (107) داخل البنية الأساسية للمنظومة.</li>
  <li>الصفحة 4: مشكلة المشروع وتشخيص الأزمات المركبة في التنقل والفعاليات والطاقة.</li>
  <li>الصفحة 5: أهداف المشروع الثلاثي المدمج عبر المحاور الخمسة.</li>
  <li>الصفحة 6: مصفوفة المشكلات والأهداف ومؤشرات الأداء القياسية (KPIs).</li>
  <li>الصفحة 7: أهمية المشروع البيئية والاقتصادية والسياحية والتشغيلية.</li>
  <li>الصفحة 8: حدود المشروع الموضوعية والتقنية والجغرافية (فلسطين المحتلة) والفيزيائية.</li>
  <li>الصفحة 9: الهيكل التشغيلي والتحسينات المدمجة وخارطة التطوير (Phase 2.0).</li>
  <li>الصفحة 10: الخاتمة، التوصيات التنفيذية، وقائمة المراجع.</li>
</ul>
<div class="page-tag">صفحة 1 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 2 ==================== -->
<div class="page-break"></div>
<h1>أولاً: المقدمة (Introduction)</h1>
<h2>1.1 التحول نحو المنصات الحضرية المترابطة بدلاً من الجزر المنعزلة</h2>
<p>تتجه المدن الذكية الحديثة نحو تخطي فكرة التطبيقات المنعزلة التي تخدم جانباً واحداً وتغفل بقية احتياجات المدينة. فالزائر أو السائح الذي يستخدم <strong>منصة ذكية لتخطيط الرحلات واستكشاف المدن (مشروع 101)</strong> يحتاج مباشرة إلى معرفة أقرب موقف شحن كهربائي متاح ومدى كفاية بطاريته للوصول للمعلم السياحي التالي، كما أن الجهة التي تنظم مؤتمراً أو مهرجاناً عبر <strong>منصة إدارة الفعاليات والتنبؤ بمعدلات الحضور (مشروع 107)</strong> بحاجة فورية إلى تهيئة سعة المواقف وترشيد الكهرباء والمياه بالقدر الفعلي للحضور، وهو ما توفره منظومة <strong>إيكو-بارك AI</strong> عبر المظلات الشمسية والتوأم الرقمي والبيئة المستدامة الخضراء.</p>

<h2>1.2 مكونات الثلاثي الهندسي المدمج</h2>
<ul>
  <li><strong>النواة التشغيلية — Eco-Park AI v5.0:</strong> إدارة المواقف الذكية، التعرف على اللوحات ANPR، المسح السريع Quick Scan QR، المظلات الشمسية (250 kW)، بطاريات BESS، روبوت الشحن EcoCharge X1 وروبوت الإخلاء R2، والمحاكيين 2D/3D، ومنظومة التشجير البيوفيلي الخضراء.</li>
  <li><strong>الذراع السياحي والمروري — مشروع رقم (101):</strong> منصة ذكية لتخطيط الرحلات واستكشاف المدن وتخصيص المسارات السياحية المستدامة وربط المعالم بنقاط شحن EV وحجز مواقفها إلكترونياً.</li>
  <li><strong>الذراع التنظيمي والتنبؤي — مشروع رقم (107):</strong> منصة ذكية لإدارة الفعاليات والتنبؤ بمعدلات الحضور، وضبط الطاقة والمياه وسعة المواقف وفق الحضور الفعلي لمنع الهدر وتقليل الفاقد.</li>
</ul>
<div class="page-tag">صفحة 2 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 3 ==================== -->
<div class="page-break"></div>
<h2>1.3 آلية الانصهار البرمجي والتشغيلي داخل نسيج النظام</h2>
<p>اعتمد التصميم مبدأ <strong>«الدمج العضوي داخل الوحدات الأساسية (Native Deep Embedding)»</strong> بدلاً من عزل المشاريع في شاشات منفصلة:</p>
<ol>
  <li><strong>انصهار مشروع 101 داخل منظومة الحجوزات والتذاكر:</strong> يخطط الزائر مساره عبر المعالم (بما يشمل مسار القدس التاريخي في فلسطين المحتلة، الرياض، كفر الشيخ، وجدة) فينعكس ذلك تلقائياً على فرع الحجز وفئة المركبة ومستوى الشحن وأثر CO₂ الموفر لإصدار تذكرة QR خضراء ونقاط كربون.</li>
  <li><strong>انصهار مشروع 107 داخل التوقعات والطاقة BESS والمحاكي 2D/3D:</strong> تتكامل جدولة الفعاليات وتوقع الحضور مباشرًة مع منظومة التنبؤ والطاقة؛ وعند رصد تعارض بين نافذة وقت الفعالية ونقص شحن BESS يُطلق النظام <strong>إشعاراً تحذيرياً فورياً يقترح تفعيل وضع Eco-Conservation</strong>، مع توسعة المواقف آلياً في 2D و3D.</li>
</ol>
<div class="kpi-note">
  <strong>قيمة التكامل الثلاثي:</strong> فعالية متوقعة الحضور (107) + مسار سياحي مخصص (101) = تشغيل مرشد للطاقة والمياه والمواقف (Eco-Park AI) بلا اختناق ولا فاقد.
</div>
<div class="page-tag">صفحة 3 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 4 ==================== -->
<div class="page-break"></div>
<h1>ثانياً: مشكلة المشروع (Problem Statement)</h1>
<h2>2.1 المشكلة العامة للثلاثي المدمج</h2>
<p>تتركز المشكلة في <strong>«انفصال أنظمة تخطيط المسارات السياحية (101) وأنظمة إدارة الفعاليات (107) عن البنية التحتية للمواقف والطاقة، مما يسبب اختناقات مرورية حول المعالم والمؤتمرات، وهدراً هائلاً في الكهرباء والمياه والتذاكر الورقية، وارتفاعاً في الانبعاثات الكربونية وضعفاً في الاستعداد المسبق للذروة»</strong>.</p>

<h2>2.2 التشخيص التفصيلي للمشكلات الفرعية</h2>
<ul>
  <li><strong>في المسارات السياحية (101):</strong> قلق نفاد مدى بطاريات EV لدى السياح وعدم ربط المعالم التراثية بمحطات شحن ومواقف محجوزة مسبقاً.</li>
  <li><strong>في إدارة الفعاليات (107):</strong> تشغيل التكييف والإنارة والمواقف والمياه بكامل السعة الاسمية للفعالية دون التنبؤ بالحضور الفعلي، ما يرفع الفاقد إلى 35–45%.</li>
  <li><strong>في المواقف والطاقة:</strong> ارتفاع الحرارة الموضعية على الأسفلت (&gt;45°C)، هدر الوقود بالعوادم (حتى 420 ppm)، وتأثر الألواح الشمسية بالعواصف الرملية (&lt;70% كفاءة) دون تنظيف آمن أو صيانة تنبؤية.</li>
  <li><strong>في الإدارة والطوارئ:</strong> بطء البوابات عند انقطاع الشبكة، والهدر الإداري الورقي في تسليم الورديات، وتأخر تصعيد إنذارات الدخان وBESS.</li>
</ul>
<div class="page-tag">صفحة 4 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 5 ==================== -->
<div class="page-break"></div>
<h1>ثالثاً: أهداف المشروع (Project Objectives)</h1>
<ol>
  <li><strong>أهداف مشروع 101 المدمج:</strong> بناء مخطط مسارات سياحية ذكي يربط المعالم الحضارية بمحطات إيكو-بارك، ويضمن سلامة مدى البطارية، ويحوّل الرحلة فوراً إلى حجز موقف QR موثق ومكافآت كربونية.</li>
  <li><strong>أهداف مشروع 107 المدمج:</strong> تطوير محرك التنبؤ بنسبة الحضور والمركبات للفعاليات، وربطه بتوسعة المواقف الآلية في 2D/3D وترشيد استهلاك الكهرباء والمياه للحد من الفاقد الكلي بنسبة ملموسة.</li>
  <li><strong>أهداف الطاقة والمراقبة (PV + BESS + V2G):</strong> مراقبة 250 kW شمسياً، اختبار الطقس المتطرف، التنظيف الجاف الآمن (رياح ≤ 35 كم/س)، تشخيص خلايا BESS، وتفعيل الوضع الليلي الذكي.</li>
  <li><strong>أهداف البيئة المستدامة الخضراء والحوكمة:</strong> تمويل التشجير البيوفيلي تلقائياً من ضريبة الكربون، تصفير الهدر الإداري، تسليم الورديات رقمياً، وتصدير تقارير الاستدامة PDF وملفات Word الأكاديمية.</li>
</ol>
<div class="page-tag">صفحة 5 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 6 ==================== -->
<div class="page-break"></div>
<h2>3.2 مصفوفة التكامل ومؤشرات الأداء القياسية (KPIs)</h2>
<table>
  <thead>
    <tr>
      <th>النظام / المصدر</th>
      <th>المشكلة المعالجة</th>
      <th>التكامل التطبيقي داخل التبويب المخصص</th>
      <th>مؤشر القياس (KPI)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>مشروع 101 (المسارات السياحية)</td>
      <td>تشتت الزوار وقلق شحن EV</td>
      <td>تخصيص معالم المدينة + فحص البطارية + حجز تذكرة QR مباشرة</td>
      <td>تحذير تلقائي إذا الشحن &lt; 18% وتوفير ملموس لـ CO₂</td>
    </tr>
    <tr>
      <td>مشروع 107 (الفعاليات والموارد)</td>
      <td>الفاقد في الكهرباء والمياه والمواقف</td>
      <td>تنبؤ الحضور والمركبات + مقارنة الفاقد + توسعة مواقف 2D/3D</td>
      <td>توفير الطاقة والمياه وخفض الفاقد الكلي 30–50%</td>
    </tr>
    <tr>
      <td>إيكو-بارك AI (البوابات والطاقة)</td>
      <td>انقطاع الشبكة والغبار الشمسي</td>
      <td>Offline Queue + مراقب &lt;70% + تنظيف جاف + روبوت EcoCharge</td>
      <td>صفر بيانات مفقودة ومراقبة لحظية 24/7</td>
    </tr>
    <tr>
      <td>البيئة الخضراء والحوكمة</td>
      <td>الاحتباس الحراري والورق الإداري</td>
      <td>ضريبة الكربون → تشجير 2D/3D + تسليم ورديات + PDF/Word</td>
      <td>تبريد حتى -4.8°C وأرشفة رقمية 100%</td>
    </tr>
  </tbody>
</table>

<div class="kpi-note">
  <strong>القراءات الحية المسجلة عند التوليد:</strong> إجمالي المواقف النشطة: <strong>${totalSpots}</strong> | إجمالي الحجوزات: <strong>${reservationsCount}</strong> | إجمالي CO₂ الموفر: <strong>${totalCo2Kg} kg</strong> | شحن BESS: <strong>${bessCharge}%</strong> | الإنتاج الشمسي: <strong>${solarKw} kW</strong>.${activeMergedTour ? `<br/><strong>حالة مشروع (101) النشطة:</strong> ${activeMergedTour.cityAr} (${activeMergedTour.totalKm} كم · شحن الوصول المتوقع ${activeMergedTour.batteryEndPct}% · توفير ${activeMergedTour.co2SavedKg} kg CO₂).` : ''}${activeMergedEvent ? `<br/><strong>حالة مشروع (107) النشطة:</strong> ${activeMergedEvent.titleAr} (حضور متوقع ${activeMergedEvent.predictedAttendance} · مركبات ${activeMergedEvent.predictedVehicles} · وفر كهرباء ${activeMergedEvent.energySavedKwh} kWh ومياه ${activeMergedEvent.waterSavedL} لتر · خفض الفاقد -${activeMergedEvent.wasteReductionPct}%).` : ''}
</div>
<div class="page-tag">صفحة 6 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 7 ==================== -->
<div class="page-break"></div>
<h1>رابعاً: أهمية المشروع (Significance)</h1>
<ul>
  <li><strong>الأهمية السياحية والحضرية (من 101):</strong> تشجيع السياحة المستدامة منخفضة الكربون في المدن التاريخية والبيئية عبر ربط المسار السياحي بمواقف شحن جاهزة دون عناء البحث.</li>
  <li><strong>الأهمية الاقتصادية وترشيد الموارد (من 107):</strong> منع إهدار آلاف الكيلوواط من الكهرباء وآلاف اللترات من المياه في الفعاليات والمؤتمرات بضبط التجهيز على التنبؤ الفعلي لا التقدير العشوائي.</li>
  <li><strong>الأهمية البيئية والتنظيمية (من Eco-Park AI):</strong> خفض البصمة الكربونية (Scope 3)، تبريد الجزيرة الحرارية عبر التشجير والري المقطّر، والقضاء على الهدر الإداري الورقي عبر 9 أدوار RBAC.</li>
  <li><strong>الأهمية البحثية:</strong> برهنة إمكانية توحيد ثلاثة مشاريع متكاملة في بنية برمجية واحدة متصلة سحابياً بـ Cloud Firestore وThree.js وRecharts والذكاء الاصطناعي.</li>
</ul>
<div class="page-tag">صفحة 7 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 8 ==================== -->
<div class="page-break"></div>
<h1>خامساً: حدود المشروع (Scope &amp; Limitations)</h1>
<ul>
  <li><strong>الحدود الموضوعية:</strong> يركز الدمج على ربط مسارات 101 وفعاليات 107 بالمواقف والشحن والطاقة والمياه والهدر وتذاكر QR؛ ولا يشمل حجز الفنادق/الطيران (في 101) أو إدارة الصوتيات المسرحية وتنسيق الديكور الداخلي للقاعات (في 107) منعاً لتضخم الواجهة.</li>
  <li><strong>الحدود التقنية:</strong> تطبيق ويب تفاعلي (React + TypeScript + Express + Firestore) يتطلب متصفحاً حديثاً (WebGL2 &amp; Web Audio API)، مع طابور عدم اتصال لضمان الاستمرارية.</li>
  <li><strong>الحدود المكانية والجغرافية:</strong> تغطية محاور المدن والفروع المرتبطة بخريطة جوجل العالمية مع التزام تثبيت مسمى <strong>«فلسطين المحتلة»</strong> ضمن بيانات الخريطة ومساراتها السياحية.</li>
  <li><strong>الحدود الفيزيائية:</strong> تعتمد معادلات التنبؤ بالحضور وتقدير الطاقة الشمسية (250 kW) والتبريد على نماذج محاكاة رياضية دقيقة قابلة للربط المادي مستقبلاً.</li>
</ul>
<div class="page-tag">صفحة 8 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 9 ==================== -->
<div class="page-break"></div>
<h1>سادساً: الهيكل التشغيلي والتحسينات الهندسية</h1>
<h2>6.1 التحسينات المدمجة فعلياً</h2>
<ul>
  <li><strong>انصهار المسارات والفعاليات (101 &amp; 107) داخل النظام:</strong> دمج مخطط الرحلات (101) في قلب الحجوزات، ومنسق الفعاليات وتوقع الحضور والفاقد (107) داخل التوقعات مع نظام إشعارات ذكي لتعارض أوقات الفعاليات ونقص BESS يوصي بـ Eco-Conservation.</li>
  <li><strong>البيئة المستدامة الخضراء البيوفيلية:</strong> تحويل ضرائب الكربون لوحدات تشجير وتبريد تظهر مجسماتها في 2D و3D.</li>
  <li><strong>الطقس المتطرف وتشخيص BESS وصمود البوابات:</strong> تنظيف جاف آمن للألواح، مناورات أعطال العواكس، طابور عدم اتصال ANPR، وتسليم الورديات الرقمي.</li>
</ul>
<h2>6.2 التطوير المستقبلي (Phase 2.0)</h2>
<ol>
  <li>الربط المادي المباشر مع أجهزة القياس via بروتوكولات OCPP 2.0.1 وMQTT.</li>
  <li>التكامل مع منصات التذاكر العامة الحكومية وهيئات السياحة لتدفق بيانات الفعاليات والمسارات آلياً.</li>
  <li>تدريب نماذج تعلم آلي تاريخية لرفع دقة التنبؤ بالحضور والازدحام إلى ما فوق 96%.</li>
</ol>
<div class="page-tag">صفحة 9 من 10 — Eco-Park AI × Project 101 × Project 107</div>

<!-- ==================== PAGE 10 ==================== -->
<div class="page-break"></div>
<h1>سابعاً: الخاتمة والتوصيات والمراجع</h1>
<p>أثبت دمج <strong>منصة المواقف الذكية المستدامة (Eco-Park AI v5.0)</strong> مع <strong>مشروع رقم (101) للمسارات السياحية المستدامة</strong> و<strong>مشروع رقم (107) لإدارة الفعاليات والتنبؤ بمعدلات الحضور وترشيد الموارد</strong> أن الحلول التكنولوجية المترابطة هي الطريق الأمثل لبناء مدن مستدامة عالية الكفاءة. فكل سائح يخطط لمساره وكل فعالية يتوقع حضورها ينعكسان مباشرة في استغلال أمثل للمواقف والطاقة الشمسية والمياه، وتقليل ملموس للانبعاثات والفاقد.</p>
<h2>التوصيات والمراجع</h2>
<ul>
  <li>تبني النموذج الموحد في البلديات والهيئات السياحية ومراكز المؤتمرات الكبرى.</li>
  <li>ربط بوابات المسح السريع QR والتوسع الآلي للمواقف مع جداول الفعاليات الموسمية.</li>
  <li><strong>المراجع:</strong> GHG Protocol Scope 3، معايير NFPA-72، بروتوكول OCPP 2.0.1، ونماذج التنبؤ والترشيد الحضري في المدن الذكية.</li>
</ul>
<div class="page-tag">صفحة 10 من 10 — نهاية الوثيقة الموحدة</div>

</body>
</html>`;

    const blob = new Blob(['\ufeff', wordHtml], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Eco-Park-101-107-Integrated-Documentation-10-Pages.doc';
    link.click();
    URL.revokeObjectURL(url);
    setExportedOnce(true);
    onNotify(
      t(
        lang,
        'تم تنزيل وثيقة Word المدمجة (Eco-Park AI + مشروع 101 + مشروع 107) في 10 صفحات!',
        'Downloaded integrated 10-page Word (.doc) including Projects 101 & 107!'
      )
    );
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            {t(
              lang,
              'مُصدّر وثيقة المشروع الكاملة لبرنامج Word (10 صفحات منسّقة)',
              '10-Page Formatted Academic Word (.doc) Project Document Exporter'
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'ينشئ ملف Microsoft Word رسمي من 10 صفحات منفصلة يشمل: الغلاف، الفهرس، المقدمة، المشكلة، الأهداف ومؤشرات KPI الحية، الأهمية، الحدود، الهيكل التشغيلي، التحسينات المدمجة والمستقبلية، والخاتمة والمراجع.',
              'Generates a ready-to-edit 10-page Word (.doc) thesis covering Cover, TOC, Introduction, Problem, Objectives & live KPIs, Significance, Scope, Operational Structure, Improvements & References.'
            )}
          </p>
        </div>

        {exportedOnce && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {t(lang, 'تم التصدير بنجاح', 'Exported')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-300">
            {t(lang, 'عنوان البحث / المشروع', 'Project Title')}
          </label>
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-300">
            {t(lang, 'اسم الباحث / الفريق', 'Author / Team Name')}
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-300">
            {t(lang, 'الجامعة / القسم / الجهة', 'University / Department')}
          </label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#08121D] p-3.5">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            {t(
              lang,
              `مضمّن تلقائياً بأحدث القراءات الحية (${totalSpots} موقفاً · ${totalCo2Kg} kg CO₂ · BESS ${bessCharge}%${activeMergedEvent ? ` · فعالية 107: -${activeMergedEvent.wasteReductionPct}% فاقد` : ''})`,
              `Includes live telemetry (${totalSpots} bays · ${totalCo2Kg} kg CO₂ · BESS ${bessCharge}%${activeMergedEvent ? ` · Event 107: -${activeMergedEvent.wasteReductionPct}% waste` : ''})`
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDownloadWord10Pages}
          className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 transition"
        >
          <Download className="h-4 w-4" />
          {t(lang, 'تنزيل وثيقة المشروع بصيغة Word (10 صفحات .doc)', 'Download 10-Page Word (.doc)')}
        </button>
      </div>
    </div>
  );
};
