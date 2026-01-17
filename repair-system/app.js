
const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ⚠️ แทนที่ URL นี้ด้วย Apps Script URL ของคุณ
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLz8-4sOXjdBW7A6TmspTmqAGMAwOugeiD00zXpEC08QfbTci0zRQPhWPDZXIod0FXIg/exec';

// Cache Configuration
const CACHE_KEY = 'repair_cache';
const CACHE_DURATION = 600000; // 10 นาที
const FILTER_KEY = 'status_filter';

// Icons Components
const AlertCircle = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const Star = ({ className }) => (
  <svg className={className} fill="currentColor" stroke="currentColor" strokeWidth="0" viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const Database = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
);

const Download = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const RefreshCw = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

// Skeleton Loading Component
const SkeletonCard = () => (
  <div className="bg-white rounded-xl p-5 border border-gray-200">
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-start gap-3 flex-1">
        <div className="skeleton h-12 w-12 rounded-lg"></div>
        <div className="flex-1">
          <div className="skeleton h-6 w-48 mb-2 rounded"></div>
          <div className="skeleton h-4 w-32 rounded"></div>
        </div>
      </div>
      <div className="skeleton h-8 w-24 rounded-full"></div>
    </div>
    <div className="grid md:grid-cols-2 gap-3 mb-4">
      <div className="skeleton h-4 w-full rounded"></div>
      <div className="skeleton h-4 w-full rounded"></div>
      <div className="skeleton h-4 w-full rounded"></div>
      <div className="skeleton h-4 w-full rounded"></div>
    </div>
    <div className="skeleton h-20 w-full rounded-lg mb-4"></div>
    <div className="skeleton h-10 w-full rounded-lg"></div>
  </div>
);

// Main Component
function RepairSystem() {
  const [currentView, setCurrentView] = useState('home');
  const [statusFilter, setStatusFilter] = useState(() => {
    try {
      return localStorage.getItem(FILTER_KEY) || 'รอดำเนินการ';
    } catch {
      return 'รอดำเนินการ';
    }
  });
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [processingIds, setProcessingIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    teacherName: '',
    department: '',
    assetNumber: '',
    phone: '',
    problemType: '',
    description: '',
    location: ''
  });
  const [deptSearch, setDepSearch] = useState('');
  const [showDeptList, setShowDeptList] = useState(false);
  const [ratingData, setRatingData] = useState({
    repairId: null,
    rating: 0,
    comment: '',
    technicianName: ''
  });

  const loadTimeoutRef = useRef(null);
  const xlsxLoadedRef = useRef(false);

  // Format date as DD/MM/YY(พ.ศ.) HH:MM น.
  const formatDateTime = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const buddhistYear = String(d.getFullYear() + 543).slice(-2); // แปลงเป็นพ.ศ.
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${buddhistYear} ${hours}:${minutes} น.`;
  };

  // Cache Helper Functions
  const getCache = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }
    return null;
  }, []);

  const setCache = useCallback((data) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Cache write error:', e);
    }
  }, []);

  // Save filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, statusFilter);
    } catch (e) {
      console.warn('localStorage write error:', e);
    }
  }, [statusFilter]);

  const loadRepairs = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCache();
      if (cached) {
        setRepairs(cached.sort((a, b) => b.id - a.id));
        setConnectionStatus('connected');
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setErrorMessage('');

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    
    loadTimeoutRef.current = setTimeout(() => {
      setErrorMessage('⏱️ การโหลดใช้เวลานานกว่าปกติ กรุณารอสักครู่...');
    }, 8000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(SCRIPT_URL, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearTimeout(loadTimeoutRef.current);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('ไม่สามารถแปลงข้อมูลเป็น JSON ได้');
      }

      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => b.id - a.id);
        setRepairs(sorted);
        setCache(sorted);
        setConnectionStatus('connected');
      } else {
        throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      }

    } catch (error) {
      clearTimeout(loadTimeoutRef.current);
      console.error('Error loading repairs:', error);
      setConnectionStatus('error');
      
      let message = 'ไม่สามารถโหลดข้อมูลได้';
      
      if (error.name === 'AbortError') {
        message = '⏱️ หมดเวลาการเชื่อมต่อ (Timeout)\n\nกรุณา:\n• ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n• ลองใหม่อีกครั้ง';
      } else if (error.message.includes('Failed to fetch')) {
        message = '❌ ไม่สามารถเชื่อมต่อกับ Google Sheets\n\n💡 แนะนำ:\n• ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n• ตรวจสอบ URL ของ Apps Script\n• ตรวจสอบสิทธิ์การเข้าถึง (ตั้งเป็น Anyone)';
      } else if (error.message.includes('HTTP error')) {
        message = `⚠️ เซิร์ฟเวอร์ตอบกลับผิดพลาด: ${error.message}`;
      } else {
        message = `⚠️ เกิดข้อผิดพลาด: ${error.message}`;
      }
      
      setErrorMessage(message);
      setRepairs([]);
      
    } finally {
      setLoading(false);
    }
  }, [getCache, setCache]);

  useEffect(() => {
    loadRepairs();  
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [loadRepairs]);

  const saveRepair = async (repair, action) => {
    try {
     const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // เพิ่มเป็น 15 วินาที

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: action,
        ...repair
      }),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    // ไม่ต้อง reload ข้อมูลทั้งหมด (ประหยัดเวลา)
    // ข้อมูลถูกอัพเดทแบบ optimistic แล้ว
    return true;

  } catch (error) {
    console.error('Error saving repair:', error);
    return false;
  }
};

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!formData.teacherName || !formData.department || !formData.assetNumber || 
      !formData.phone || !formData.problemType || !formData.description || !formData.location) {
    alert('⚠️ กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  const phoneDigits = formData.phone.replace(/[^\d]/g, '');
  if (phoneDigits.length !== 10) {
    alert('⚠️ กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
    return;
  }

  const newRepair = {
    id: Date.now(),
    ...formData,
    status: 'รอดำเนินการ',
    createdAt: formatDateTime(new Date()),
    completedAt: null,
    rating: null
  };

  // 🚀 OPTIMISTIC UPDATE - แสดงผลทันที
  setRepairs(prev => [newRepair, ...prev]);
  setCache([newRepair, ...repairs]); // อัพเดท cache
  
  // ล้างฟอร์ม และเปลี่ยนหน้าทันที
  setFormData({
    teacherName: '',
    department: '',
    assetNumber: '',
    phone: '',
    problemType: '',
    description: '',
    location: ''
  });
  setStatusFilter('รอดำเนินการ');
  setCurrentView('list');
  
  // แสดงข้อความสำเร็จทันที
  alert('✅ บันทึกการแจ้งซ่อมเรียบร้อยแล้ว');

  // 📤 ส่งไป Google Sheets ในพื้นหลัง (ไม่ต้องรอ)
  setIsSubmitting(true);
  const success = await saveRepair(newRepair, 'add');
  setIsSubmitting(false);
  
  if (!success) {
    // ถ้าส่งไม่สำเร็จ แสดง toast เตือนเบาๆ (ไม่ลบข้อมูล)
    console.warn('⚠️ ข้อมูลถูกบันทึกในเครื่อง แต่ยังไม่ได้ส่งไปยัง Google Sheets');
  }
};

  const updateRepairStatus = async (repairId, newStatus) => {
    const repair = repairs.find(r => r.id === repairId);
  if (!repair) return;

  if (processingIds.has(repairId)) return;

  const updated = {
    ...repair,
    status: newStatus,
    completedAt: newStatus === 'เสร็จสิ้น' ? formatDateTime(new Date()) : repair.completedAt
  };

  // 🚀 OPTIMISTIC UPDATE - เปลี่ยนสถานะทันที
  setRepairs(prev => prev.map(r => r.id === repairId ? updated : r));
  setCache(repairs.map(r => r.id === repairId ? updated : r)); // อัพเดท cache

  // เปลี่ยน tab ทันที
  if (newStatus === 'กำลังดำเนินการ') {
    setTimeout(() => setStatusFilter('กำลังดำเนินการ'), 100);
  } else if (newStatus === 'เสร็จสิ้น') {
    setTimeout(() => setStatusFilter('เสร็จสิ้น'), 100);
  }

  // 📤 ส่งไป Google Sheets ในพื้นหลัง
  setProcessingIds(prev => new Set([...prev, repairId]));
  const success = await saveRepair(updated, 'update');
  setProcessingIds(prev => {
    const newSet = new Set(prev);
    newSet.delete(repairId);
    return newSet;
  });

  if (!success) {
    // ถ้าส่งไม่สำเร็จ rollback
    setRepairs(prev => prev.map(r => r.id === repairId ? repair : r));
    alert('❌ เกิดข้อผิดพลาดในการอัปเดตสถานะ กรุณาลองใหม่อีกครั้ง');
    setStatusFilter(repair.status);
  }
};

  const handleRatingSubmit = async () => {
    if (ratingData.rating === 0) {
      alert('⚠️ กรุณาให้คะแนน');
      return;
    }

    setIsSubmitting(true);

    const repair = repairs.find(r => r.id === ratingData.repairId);
    if (!repair) {
      setIsSubmitting(false);
      return;
    }

    const updated = {
      ...repair,
      rating: {
        technicianName: ratingData.technicianName,
        score: ratingData.rating,
        comment: ratingData.comment
      }
    };

    setRepairs(prev => prev.map(r => r.id === ratingData.repairId ? updated : r));

    const success = await saveRepair(updated, 'update');
    
    setIsSubmitting(false);
    
    if (success) {
      setRatingData({ repairId: null, rating: 0, comment: '', technicianName: '' });
      alert('✅ ขอบคุณสำหรับการให้คะแนนค่ะ');
      setCurrentView('list');
    } else {
      setRepairs(prev => prev.map(r => r.id === ratingData.repairId ? repair : r));
      alert('❌ เกิดข้อผิดพลาดในการบันทึกการประเมิน');
    }
  };

  const startRating = (repair) => {
    setRatingData({
      repairId: repair.id,
      rating: 0,
      comment: '',
      technicianName: 'ฟลุ๊ก ศรัณย์ภัทร'
    });
    setCurrentView('rating');
  };

  const exportToExcel = () => {
    if (repairs.length === 0) {
      alert('⚠️ ไม่มีข้อมูลให้ Export');
      return;
    }

    if (xlsxLoadedRef.current || window.XLSX) {
      performExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => {
        xlsxLoadedRef.current = true;
        performExport();
      };
      script.onerror = () => {
        alert('❌ ไม่สามารถโหลดตัว Export ได้ กรุณาลองใหม่');
      };
      document.head.appendChild(script);
    }
  };

  const performExport = () => {
    const excelData = repairs.map((repair, index) => ({
      'ลำดับ': index + 1,
      'ชื่อผู้แจ้ง': repair.teacherName,
      'หน่วยงาน': repair.department,
      'หมายเลขครุภัณฑ์': repair.assetNumber,
      'เบอร์โทร': repair.phone,
      'ประเภทปัญหา': repair.problemType,
      'สถานที่': repair.location,
      'รายละเอียดปัญหา': repair.description,
      'สถานะ': repair.status,
      'วันที่แจ้ง': repair.createdAt,
      'วันที่เสร็จสิ้น': repair.completedAt || '-',
      'ช่างผู้ซ่อม': repair.rating?.technicianName || '-',
      'คะแนนประเมิน': repair.rating?.score ? `${repair.rating.score} ดาว` : '-',
      'ความคิดเห็น': repair.rating?.comment || '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    const colWidths = [
      { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, 
      { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 15 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 40 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'รายการแจ้งซ่อม');

    const date = new Date();
    const filename = `รายการแจ้งซ่อม_${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}.xlsx`;

    XLSX.writeFile(wb, filename);
    alert('✅ ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'รอดำเนินการ': return 'bg-yellow-100 text-yellow-800';
      case 'กำลังดำเนินการ': return 'bg-blue-100 text-blue-800';
      case 'เสร็จสิ้น': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const allDepartments = [
  '-- เลือกแผนก/งาน --',
  '📚 แผนก',
  'แผนกคอมพิวเตอร์โปรแกรมเมอร์',
  'แผนกการบัญชี',
  'แผนกการตลาด',
  'แผนกการจัดการสำนักงาน/การจัดการโลจิสติกส์และซัพพลายเชน',
  'แผนกดิจิทัลกราฟิก',
  'แผนกการท่องเที่ยว',
  'แผนกการโรงแรม',
  'แผนกเทคโนโลยีธุรกิจดิจิทัล',
  'แผนกสามัญ-สัมพันธ์',
  'แผนกคหกรรมศาสตร์',
  'แผนกอาหารและโภชนาการ',
  'แผนกเทคโนโลยีแฟชั่นและเครื่องแต่งกาย',
  '🏢 งาน',
  'งานประกันคุณภาพ',
  'งานวัดผลและประเมินผล',
  'งานพัฒนาหลักสูตรการเรียนการสอน',
  'งานพัสดุ',
  'งานการเงิน',
  'งานบัญชี',
  'งานทะเบียน',
  'งานบุคลากร',
  'งานอาคารสถานที่',
  'งานประชาสัมพันธ์',
  'งานความร่วมมือ',
  'งานวางแผนและงบประมาณ',
  'งานวิจัย',
  'งานปกครอง',
  'งานครูที่ปรึกษา',
  'งานกิจกรรมนักเรียน',
  'งานโครงการพิเศษ',
  'งานอาชีวศึกษาระบบทวิภาคี',
  'งานวิทยบริการและห้องสมุด',
  'งานแนะแนวอาชีพและจัดหางาน',
  'งานส่งเสริมผลิตผลการค้าและประกอบธุรกิจ',
  'งานสวัสดิการนักเรียน นักศึกษา'
];
  
const filteredDepts = deptSearch
  ? allDepartments.filter(d => 
      d.toLowerCase().includes(deptSearch.toLowerCase()) &&
      !d.startsWith('📚') && !d.startsWith('🏢') && !d.startsWith('--')
    )
  : allDepartments.filter(d => !d.startsWith('--'));
  
  const filteredRepairs = useMemo(() => 
    repairs.filter(r => r.status === statusFilter),
    [repairs, statusFilter]
  );

  const statusCounts = useMemo(() => ({
    รอดำเนินการ: repairs.filter(r => r.status === 'รอดำเนินการ').length,
    กำลังดำเนินการ: repairs.filter(r => r.status === 'กำลังดำเนินการ').length,
    เสร็จสิ้น: repairs.filter(r => r.status === 'เสร็จสิ้น').length
  }), [repairs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img 
                  src="Fix-Foder/logo.png" 
                  alt="Logo" 
                  className="h-20 w-20 object-contain bg-white rounded-xl p-2 shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <h1 className="text-3xl font-bold mb-2">ระบบแจ้งซ่อมคอมพิวเตอร์และอุปกรณ์</h1>
                  <p className="text-blue-100">วิทยาลัยอาชีวศึกษาสุรินทร์</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                  connectionStatus === 'error' ? 'bg-red-400' :
                  'bg-yellow-400 animate-pulse'
                }`}></div>
                <span className="text-blue-100">
                  {connectionStatus === 'connected' && '🟢 เชื่อมต่อสำเร็จ'}
                  {connectionStatus === 'error' && '🔴 ไม่สามารถเชื่อมต่อ'}
                  {connectionStatus === 'connecting' && '🟡 กำลังเชื่อมต่อ...'}
                </span>
              </div>
              {connectionStatus === 'error' && (
                <button
                  onClick={() => loadRepairs(true)}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  ลองใหม่
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6 rounded-r-lg animate-slideIn">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-red-800 mb-1">เกิดข้อผิดพลาด</h3>
                  <p className="text-sm text-red-700 whitespace-pre-line">{errorMessage}</p>
                  <button
                    onClick={() => loadRepairs(true)}
                    className="mt-3 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-all"
                  >
                    <RefreshCw className="h-4 w-4" />
                    ลองเชื่อมต่อใหม่
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex-1 py-3 px-4 font-medium transition-all ${
                currentView === 'home'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📝 แจ้งซ่อม
            </button>
            <button
              onClick={() => setCurrentView('list')}
              className={`flex-1 py-3 px-4 font-medium transition-all ${
                currentView === 'list'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 รายการแจ้งซ่อม ({statusCounts.รอดำเนินการ})
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
                <div className="text-center text-gray-500 text-sm mt-4">
                  กำลังโหลดข้อมูล...
                </div>
              </div>
            ) : (
              <>
                {/* Form View */}
                {currentView === 'home' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-medium text-blue-800 mb-1">คำแนะนำการแจ้งซ่อม</h3>
                          <p className="text-sm text-blue-700">กรุณากรอกข้อมูลให้ครบถ้วนและละเอียดเพื่อความรวดเร็วในการให้บริการ</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-2">
                          👤 ชื่อ-นามสกุล ผู้แจ้ง <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="teacherName"
                          value={formData.teacherName}
                          onChange={handleInputChange}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="ระบุชื่อ-นามสกุล"
                        />
                      </div>

                    <div className="relative">
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    🏢 แผนก/งาน <span className="text-red-500">*</span>
  </label>
  
  {/* 🔍 ช่องค้นหา */}
  <input
    type="text"
    value={deptSearch || formData.department}
    onChange={(e) => {
      setDeptSearch(e.target.value);
      setShowDeptList(true);
    }}
    onFocus={() => setShowDeptList(true)}
    disabled={isSubmitting}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
    placeholder="🔍 พิมพ์เพื่อค้นหา..."
  />
  
  {/* 📋 รายการแผนก/งาน */}
  {showDeptList && (
    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
      {filteredDepts.length === 0 ? (
        <div className="px-4 py-3 text-gray-500 text-center">
          ไม่พบรายการที่ค้นหา
        </div>
      ) : (
        filteredDepts.map((dept, idx) => {
          // ถ้าเป็นหัวข้อกลุ่ม
          if (dept.startsWith('📚') || dept.startsWith('🏢')) {
            return (
              <div key={idx} className="px-4 py-2 bg-gray-100 font-bold text-gray-700 text-sm">
                {dept}
              </div>
            );
          }
          // รายการปกติ
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setFormData({ ...formData, department: dept });
                setDeptSearch('');
                setShowDeptList(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors text-sm"
            >
              {dept}
            </button>
          );
        })
      )}
    </div>
  )}
  
  {/* ปิด dropdown เมื่อคลิกนอก */}
  {showDeptList && (
    <div
      className="fixed inset-0 z-0"
      onClick={() => setShowDeptList(false)}
    />
  )}
</div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          🔢 หมายเลขครุภัณฑ์ <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="assetNumber"
                          value={formData.assetNumber}
                          onChange={handleInputChange}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="เช่น 417-64-0001"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          📞 เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numbers = value.replace(/[^\d]/g, '');
                            const limited = numbers.slice(0, 10);
                            
                            let formatted = limited;
                            if (limited.length > 6) {
                              formatted = limited.slice(0, 3) + '-' + limited.slice(3, 6) + '-' + limited.slice(6);
                            } else if (limited.length > 3) {
                              formatted = limited.slice(0, 3) + '-' + limited.slice(3);
                            }
                            
                            setFormData({ ...formData, phone: formatted });
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="xxx-xxx-xxxx"
                          maxLength="12"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            🔧 ประเภทปัญหา <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="problemType"
                            value={formData.problemType}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">เลือกประเภทปัญหา</option>
                            <option value="คอมพิวเตอร์">🖥️ คอมพิวเตอร์</option>
                            <option value="เครื่องพิมพ์">🖨️ เครื่องพิมพ์</option>
                            <option value="เครือข่าย/อินเทอร์เน็ต">🌐 เครือข่าย/อินเทอร์เน็ต</option>
                            <option value="โปรแกรม/ซอฟต์แวร์">💾 โปรแกรม/ซอฟต์แวร์</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            📍 สถานที่ <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="อาคาร/ห้อง"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          📝 รายละเอียดปัญหา <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          disabled={isSubmitting}
                          rows="5"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="อธิบายปัญหาที่พบโดยละเอียด เช่น คอมพิวเตอร์เปิดเครื่องไม่ติด, ไวไฟใช้ไม่ได้, Office ใช้งานไม่ได้"
                        />
                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={connectionStatus === 'error' || isSubmitting}
                        className={`w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${isSubmitting ? 'button-processing' : ''}`}
                      >
                        {isSubmitting ? '⏳ กำลังส่งข้อมูล...' : connectionStatus === 'error' ? '⚠️ ไม่สามารถส่งได้ (ไม่เชื่อมต่อ)' : '📤 ส่งแจ้งซ่อม'}
                      </button>
                    </div>
                  </div>
                )}

                {/* List View */}
                {currentView === 'list' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                      <button
                        onClick={() => setStatusFilter('รอดำเนินการ')}
                        className={`px-6 py-3 font-medium whitespace-nowrap transition-all ${
                          statusFilter === 'รอดำเนินการ'
                            ? 'text-yellow-600 border-b-2 border-yellow-600 bg-yellow-50'
                            : 'text-gray-600 hover:text-yellow-600 hover:bg-gray-50'
                        }`}
                      >
                        ⏳ รอดำเนินการ ({statusCounts.รอดำเนินการ})
                      </button>
                      <button
                        onClick={() => setStatusFilter('กำลังดำเนินการ')}
                        className={`px-6 py-3 font-medium whitespace-nowrap transition-all ${
                          statusFilter === 'กำลังดำเนินการ'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                      >
                        🔧 กำลังดำเนินการ ({statusCounts.กำลังดำเนินการ})
                      </button>
                      <button
                        onClick={() => setStatusFilter('เสร็จสิ้น')}
                        className={`px-6 py-3 font-medium whitespace-nowrap transition-all ${
                          statusFilter === 'เสร็จสิ้น'
                            ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                            : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
                        }`}
                      >
                        ✅ เสร็จสิ้น ({statusCounts.เสร็จสิ้น})
                      </button>
                    </div>

                    {filteredRepairs.length > 0 && (
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Database className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">
                              {statusFilter} {filteredRepairs.length} รายการ
                            </p>
                            <p className="text-xs text-gray-500">
                              ทั้งหมด {repairs.length} รายการ
                            </p>
                          </div>
                        </div>
                        {statusFilter === 'เสร็จสิ้น' && (
                          <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 bg-green-600 text-white py-2.5 px-5 rounded-lg font-medium hover:bg-green-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          >
                            <Download className="h-5 w-5" />
                            Export Excel
                          </button>
                        )}
                      </div>
                    )}

                    {filteredRepairs.length === 0 ? (
                      <div className="text-center py-16 text-gray-500">
                        <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                          <AlertCircle className="h-12 w-12 opacity-50" />
                        </div>
                        <p className="text-lg font-medium mb-2">ไม่มีรายการ{statusFilter}</p>
                        <p className="text-sm text-gray-400">รายการจะแสดงเมื่อมีการแจ้งซ่อม</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredRepairs.map((repair) => {
                          const isProcessing = processingIds.has(repair.id);
                          return (
                            <div key={repair.id} className={`bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-all hover:border-blue-300 ${isProcessing ? 'opacity-70' : ''}`}>
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-start gap-3">
                                  <div className="bg-blue-100 p-2 rounded-lg mt-1">
                                    <AlertCircle className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-lg text-gray-800">
                                      {repair.teacherName}
                                    </h3>
                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                      <span>🏢</span> {repair.department}
                                    </p>
                                  </div>
                                </div>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(repair.status)}`}>
                                  {repair.status}
                                </span>
                              </div>

                              <div className="grid md:grid-cols-2 gap-3 mb-4 text-sm bg-gray-50 p-4 rounded-lg">
                                <div className="text-gray-700">
                                  <span className="font-semibold">🔧 ประเภท:</span> {repair.problemType}
                                </div>
                                <div className="text-gray-700">
                                  <span className="font-semibold">🔢 ครุภัณฑ์:</span> {repair.assetNumber}
                                </div>
                                <div className="text-gray-700">
                                  <span className="font-semibold">📞 เบอร์โทร:</span> {repair.phone}
                                </div>
                                <div className="text-gray-700">
                                  <span className="font-semibold">📍 สถานที่:</span> {repair.location}
                                </div>
                                <div className="text-gray-700 col-span-2">
                                  <span className="font-semibold">🕐 แจ้งเมื่อ:</span> {repair.createdAt}
                                </div>
                              </div>

                              <div className="bg-blue-50 p-4 rounded-lg mb-4 border-l-4 border-blue-500">
                                <p className="text-sm text-gray-800 leading-relaxed">
                                  <span className="font-semibold text-blue-800">📝 ปัญหา:</span> {repair.description}
                                </p>
                              </div>

                              {repair.rating && repair.rating.score > 0 && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm font-semibold text-green-800">✅ การประเมิน:</span>
                                    <div className="flex">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`h-5 w-5 ${
                                            star <= repair.rating.score
                                              ? 'fill-yellow-400 text-yellow-400'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-sm font-bold text-green-700">({repair.rating.score}/5)</span>
                                  </div>
                                  {repair.rating.technicianName && (
                                    <p className="text-sm text-gray-700 mb-2">
                                      <span className="font-semibold">👨‍🔧 ช่างผู้ซ่อม:</span> {repair.rating.technicianName}
                                    </p>
                                  )}
                                  {repair.rating.comment && (
                                    <p className="text-sm text-gray-700 italic bg-white p-3 rounded border border-green-200">
                                      💬 {repair.rating.comment}
                                    </p>
                                  )}
                                </div>
                              )}

                              {isProcessing && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 mb-3 flex items-center gap-3 animate-pulse shadow-md">
                                  <div className="h-6 w-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                  <div>
                                    <p className="text-sm text-blue-800 font-bold">✨ กำลังอัปเดตสถานะ...</p>
                                    <p className="text-xs text-blue-600">กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูล</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                {repair.status === 'รอดำเนินการ' && (
                                  <button
                                    onClick={() => updateRepairStatus(repair.id, 'กำลังดำเนินการ')}
                                    disabled={connectionStatus === 'error' || isProcessing}
                                    className={`flex-1 bg-blue-500 text-white py-2.5 px-4 rounded-lg hover:bg-blue-600 transition-all text-sm font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform ${!isProcessing ? 'hover:scale-105' : ''}`}
                                  >
                                    {isProcessing ? (
                                      <span className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        กำลังเปลี่ยน...
                                      </span>
                                    ) : '▶️ เริ่มดำเนินการ'}
                                  </button>
                                )}
                                {repair.status === 'กำลังดำเนินการ' && (
                                  <button
                                    onClick={() => updateRepairStatus(repair.id, 'เสร็จสิ้น')}
                                    disabled={connectionStatus === 'error' || isProcessing}
                                    className={`flex-1 bg-green-500 text-white py-2.5 px-4 rounded-lg hover:bg-green-600 transition-all text-sm font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform ${!isProcessing ? 'hover:scale-105' : ''}`}
                                  >
                                    {isProcessing ? (
                                      <span className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        กำลังเปลี่ยน...
                                      </span>
                                    ) : '✅ เสร็จสิ้น'}
                                  </button>
                                )}
                                {repair.status === 'เสร็จสิ้น' && (!repair.rating || repair.rating.score === 0) && (
                                  <button
                                    onClick={() => startRating(repair)}
                                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2.5 px-4 rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                                  >
                                    ⭐ ประเมินการบริการ
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating View */}
                {currentView === 'rating' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl">
                      <div className="bg-white rounded-full p-4 w-16 h-16 mx-auto mb-4 shadow-md">
                        <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">ประเมินการให้บริการ</h2>
                      <p className="text-gray-600">โปรดให้คะแนนความพึงพอใจในการให้บริการครั้งนี้</p>
                    </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👨‍🔧 ชื่อช่างผู้ซ่อม
                  </label>
                  <input
                    type="text"
                    value={ratingData.technicianName}
                    onChange={(e) => setRatingData({...ratingData, technicianName: e.target.value})}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="ระบุชื่อช่างผู้ซ่อม"
                  />
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-xl border-2 border-yellow-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                    ให้คะแนน <span className="text-red-500">*</span>
                  </label>
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingData({...ratingData, rating: star})}
                        disabled={isSubmitting}
                        className="transition-transform hover:scale-125 active:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Star
                          className={`h-14 w-14 ${
                            star <= ratingData.rating
                              ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg'
                              : 'text-gray-300 hover:text-yellow-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {ratingData.rating > 0 && (
                    <div className="text-center mt-4">
                      <p className="text-lg font-bold text-yellow-700">
                        คุณให้คะแนน {ratingData.rating} ดาว ⭐
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {ratingData.rating === 5 && '😍 ยอดเยี่ยม!'}
                        {ratingData.rating === 4 && '😊 ดีมาก!'}
                        {ratingData.rating === 3 && '🙂 ดี'}
                        {ratingData.rating === 2 && '😐 พอใช้'}
                        {ratingData.rating === 1 && '😞 ควรปรับปรุง'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💬 ความคิดเห็นเพิ่มเติม
                  </label>
                  <textarea
                    value={ratingData.comment}
                    onChange={(e) => setRatingData({...ratingData, comment: e.target.value})}
                    disabled={isSubmitting}
                    rows="4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="แสดงความคิดเห็นเกี่ยวกับการให้บริการ (ถ้ามี)"
                  />
                </div>

                {isSubmitting && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3 animate-pulse">
                    <div className="h-6 w-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-blue-700 font-medium">กำลังบันทึกการประเมิน...</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentView('list')}
                    disabled={isSubmitting}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleRatingSubmit}
                    disabled={ratingData.rating === 0 || connectionStatus === 'error' || isSubmitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400 transform hover:-translate-y-0.5"
                  >
                    {isSubmitting ? '⏳ กำลังส่ง...' : '✅ ส่งการประเมิน'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
</div>
  );
}

// Render App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<RepairSystem />);
                          
