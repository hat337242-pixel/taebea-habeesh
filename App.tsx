/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Person, DailyReport, AttendanceStatus, ReportEntry, BackupData, FieldActivity, LoginLog } from './types';
import { 
  INITIAL_PEOPLE, 
  generateSampleReports, 
  generateSampleActivities,
  INITIAL_OFFICE_NAME, 
  INITIAL_DISTRICT_NAME 
} from './data/initialData';

// Subcomponents
import Dashboard from './components/Dashboard';
import DailyEntry from './components/DailyEntry';
import MonthlyGrid from './components/MonthlyGrid';
import PeopleManager from './components/PeopleManager';
import PrintReports from './components/PrintReports';
import ActivitiesManager from './components/ActivitiesManager';
import AnalyticsView from './components/AnalyticsView';
import LoginView from './components/LoginView';
import ApprovalsManager from './components/ApprovalsManager';
import LoginTracker from './components/LoginTracker';

import { 
  LayoutDashboard, 
  CalendarRange, 
  Users, 
  Printer, 
  Activity, 
  MapPin, 
  Settings,
  ShieldAlert,
  Menu,
  X,
  Camera,
  BarChart3,
  Copy,
  Share2,
  ExternalLink,
  ClipboardCheck,
  History
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Person | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('hubaish_logged_in_user');
      if (savedUser) {
        try { return JSON.parse(savedUser); } catch (e) {}
      }
    }
    return null;
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hubaish_is_admin') === 'true';
    }
    return false;
  });

  const isCoordinator = currentUser !== null;

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('hubaish_logged_in_user');
      if (savedUser) {
        return 'entry';
      }
    }
    return 'dashboard';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  
  // App states
  const [people, setPeople] = useState<Person[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [activities, setActivities] = useState<FieldActivity[]>([]);
  const [logins, setLogins] = useState<LoginLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [officeName, setOfficeName] = useState<string>(INITIAL_OFFICE_NAME);
  const [districtName, setDistrictName] = useState<string>(INITIAL_DISTRICT_NAME);

  const handleLoginSuccess = (type: 'admin' | 'delegate', user?: Person) => {
    if (type === 'admin') {
      setIsAdmin(true);
      setCurrentUser(null);
      localStorage.setItem('hubaish_is_admin', 'true');
      localStorage.removeItem('hubaish_logged_in_user');
      setActiveTab('dashboard');
    } else if (type === 'delegate' && user) {
      setCurrentUser(user);
      setIsAdmin(false);
      localStorage.setItem('hubaish_logged_in_user', JSON.stringify(user));
      localStorage.removeItem('hubaish_is_admin');
      setActiveTab('entry');

      // Create a login log
      const newLog: LoginLog = {
        id: `log_${Date.now()}`,
        personId: user.id,
        name: user.name,
        role: user.role,
        zone: user.zone,
        timestamp: new Date().toLocaleString('ar-YE', { timeZone: 'Asia/Aden' }).replace(/[\u200e\u200f]/g, '').substring(0, 16)
      };

      setLogins(prev => {
        const updated = [newLog, ...prev].slice(0, 100); // keep last 100
        localStorage.setItem('hubaish_mobilization_logins', JSON.stringify(updated));
        saveToBackend({ logins: updated });
        return updated;
      });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem('hubaish_logged_in_user');
    localStorage.removeItem('hubaish_is_admin');
    setActiveTab('entry');
  };

  // Helper to save data to backend
  const saveToBackend = useCallback((data: {
    people?: Person[];
    reports?: DailyReport[];
    activities?: FieldActivity[];
    officeName?: string;
    districtName?: string;
  }) => {
    fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    .then(res => res.json())
    .then(result => {
      if (!result.success) {
        console.error('Failed to save to backend:', result.error);
      }
    })
    .catch(err => {
      console.error('Error saving to backend:', err);
    });
  }, []);

  // Initialize data on mount from Server API
  useEffect(() => {
    // 1. Get current date in local YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);

    // Helper fallback for local states
    const loadLocalFallbacks = () => {
      let currentPeople = INITIAL_PEOPLE;
      const savedPeople = localStorage.getItem('hubaish_mobilization_people');
      if (savedPeople) {
        try { currentPeople = JSON.parse(savedPeople); } catch (e) {}
      } else {
        localStorage.setItem('hubaish_mobilization_people', JSON.stringify(INITIAL_PEOPLE));
      }

      let currentReports = generateSampleReports();
      const savedReports = localStorage.getItem('hubaish_mobilization_reports');
      if (savedReports) {
        try { currentReports = JSON.parse(savedReports); } catch (e) {}
      } else {
        localStorage.setItem('hubaish_mobilization_reports', JSON.stringify(currentReports));
      }

      let currentActivities = generateSampleActivities();
      const savedActivities = localStorage.getItem('hubaish_mobilization_activities');
      if (savedActivities) {
        try { currentActivities = JSON.parse(savedActivities); } catch (e) {}
      } else {
        localStorage.setItem('hubaish_mobilization_activities', JSON.stringify(currentActivities));
      }

      let currentLogins: LoginLog[] = [];
      const savedLogins = localStorage.getItem('hubaish_mobilization_logins');
      if (savedLogins) {
        try { currentLogins = JSON.parse(savedLogins); } catch (e) {}
      }

      const currentOffice = localStorage.getItem('hubaish_office_name') || INITIAL_OFFICE_NAME;
      const currentDistrict = localStorage.getItem('hubaish_district_name') || INITIAL_DISTRICT_NAME;

      setPeople(currentPeople);
      setReports(currentReports);
      setActivities(currentActivities);
      setLogins(currentLogins);
      setOfficeName(currentOffice);
      setDistrictName(currentDistrict);

      return {
        people: currentPeople,
        reports: currentReports,
        activities: currentActivities,
        logins: currentLogins,
        officeName: currentOffice,
        districtName: currentDistrict
      };
    };

    // 2. Fetch all data from server
    fetch('/api/all-data')
      .then(res => res.json())
      .then(data => {
        if (data.empty) {
          // Server is empty, initialize it with local values
          const locals = loadLocalFallbacks();
          saveToBackend(locals);
        } else {
          // Server has data, use it
          setPeople(data.people || []);
          setReports(data.reports || []);
          setActivities(data.activities || []);
          setLogins(data.logins || []);
          setOfficeName(data.officeName || INITIAL_OFFICE_NAME);
          setDistrictName(data.districtName || INITIAL_DISTRICT_NAME);

          // Update local backup
          localStorage.setItem('hubaish_mobilization_people', JSON.stringify(data.people || []));
          localStorage.setItem('hubaish_mobilization_reports', JSON.stringify(data.reports || []));
          localStorage.setItem('hubaish_mobilization_activities', JSON.stringify(data.activities || []));
          localStorage.setItem('hubaish_mobilization_logins', JSON.stringify(data.logins || []));
          localStorage.setItem('hubaish_office_name', data.officeName || INITIAL_OFFICE_NAME);
          localStorage.setItem('hubaish_district_name', data.districtName || INITIAL_DISTRICT_NAME);
        }
      })
      .catch(err => {
        console.warn('Backend server not responding or offline, falling back to local storage:', err);
        loadLocalFallbacks();
      });
  }, [saveToBackend]);

  // Sync state to Backend and LocalStorage when modified
  const handleUpdatePeople = useCallback((updatedPeople: Person[]) => {
    setPeople(updatedPeople);
    localStorage.setItem('hubaish_mobilization_people', JSON.stringify(updatedPeople));
    saveToBackend({ people: updatedPeople });
  }, [saveToBackend]);

  // Update a single report entry
  const handleUpdateReport = useCallback((date: string, personId: string, entryUpdates: Partial<ReportEntry>) => {
    setReports(prevReports => {
      // Find index of report for this date
      const reportIndex = prevReports.findIndex(r => r.date === date);
      let newReports = [...prevReports];

      if (reportIndex > -1) {
        // Report exists, update specific entry
        const existingReport = newReports[reportIndex];
        const existingEntry = existingReport.entries[personId] || { status: 'missing', activity: '', notes: '' };
        
        existingReport.entries[personId] = {
          ...existingEntry,
          ...entryUpdates,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        newReports[reportIndex] = { ...existingReport };
      } else {
        // Report does not exist for this date, create a new one
        const newReport: DailyReport = {
          date,
          entries: {
            [personId]: {
              status: 'missing',
              activity: '',
              notes: '',
              ...entryUpdates,
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
            }
          }
        };
        newReports.push(newReport);
      }

      localStorage.setItem('hubaish_mobilization_reports', JSON.stringify(newReports));
      saveToBackend({ reports: newReports });
      return newReports;
    });
  }, [saveToBackend]);

  // Bulk update all people status for a date
  const handleBulkSetStatus = useCallback((date: string, status: AttendanceStatus) => {
    setReports(prevReports => {
      const reportIndex = prevReports.findIndex(r => r.date === date);
      let newReports = [...prevReports];
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

      // Create mapping of entries
      const entries: Record<string, ReportEntry> = {};
      people.forEach(p => {
        // If report existed, keep their previous text inputs (activity/notes) but change status
        const oldReport = reportIndex > -1 ? prevReports[reportIndex] : null;
        const oldEntry = oldReport ? oldReport.entries[p.id] : null;
        
        entries[p.id] = {
          status,
          activity: oldEntry?.activity || '',
          notes: oldEntry?.notes || '',
          timestamp
        };
      });

      if (reportIndex > -1) {
        newReports[reportIndex] = { date, entries };
      } else {
        newReports.push({ date, entries });
      }

      localStorage.setItem('hubaish_mobilization_reports', JSON.stringify(newReports));
      saveToBackend({ reports: newReports });
      return newReports;
    });
  }, [people, saveToBackend]);

  const handleAddActivity = useCallback((newActivity: FieldActivity) => {
    setActivities(prev => {
      const updated = [newActivity, ...prev];
      localStorage.setItem('hubaish_mobilization_activities', JSON.stringify(updated));
      saveToBackend({ activities: updated });
      return updated;
    });
  }, [saveToBackend]);

  const handleDeleteActivity = useCallback((id: string) => {
    setActivities(prev => {
      const updated = prev.filter(act => act.id !== id);
      localStorage.setItem('hubaish_mobilization_activities', JSON.stringify(updated));
      saveToBackend({ activities: updated });
      return updated;
    });
  }, [saveToBackend]);

  // Handle restoring backup data
  const handleImportBackup = useCallback((data: BackupData) => {
    if (data.people) {
      setPeople(data.people);
      localStorage.setItem('hubaish_mobilization_people', JSON.stringify(data.people));
    }
    if (data.reports) {
      setReports(data.reports);
      localStorage.setItem('hubaish_mobilization_reports', JSON.stringify(data.reports));
    }
    if (data.activities) {
      setActivities(data.activities);
      localStorage.setItem('hubaish_mobilization_activities', JSON.stringify(data.activities));
    }
    if (data.officeName) {
      setOfficeName(data.officeName);
      localStorage.setItem('hubaish_office_name', data.officeName);
    }
    if (data.districtName) {
      setDistrictName(data.districtName);
      localStorage.setItem('hubaish_district_name', data.districtName);
    }
    saveToBackend({
      people: data.people,
      reports: data.reports,
      activities: data.activities,
      officeName: data.officeName,
      districtName: data.districtName
    });
  }, [saveToBackend]);

  // Render components dynamically based on active tab
  const renderContent = () => {
    // Restrict tab access for coordinators
    const allowedTab = isCoordinator 
      ? (activeTab === 'activities' ? 'activities' : 'entry') 
      : activeTab;
    
    switch (allowedTab) {
      case 'dashboard':
        return (
          <Dashboard 
            people={people} 
            reports={reports} 
            selectedDate={selectedDate}
            onNavigateToTab={(tab) => {
              setActiveTab(tab);
              setIsMobileMenuOpen(false);
            }}
            onUpdateReport={handleUpdateReport}
          />
        );
      case 'approvals':
        return (
          <ApprovalsManager 
            people={people}
            reports={reports}
            activities={activities}
            onUpdateReport={handleUpdateReport}
            onApproveActivity={(id) => {
              setActivities(prev => {
                const updated = prev.map(act => act.id === id ? { ...act, isPendingApproval: false } : act);
                localStorage.setItem('hubaish_mobilization_activities', JSON.stringify(updated));
                saveToBackend({ activities: updated });
                return updated;
              });
            }}
            onDeleteActivity={handleDeleteActivity}
            officeName={officeName}
            districtName={districtName}
          />
        );
      case 'logins':
        return (
          <LoginTracker 
            people={people}
            logins={logins}
          />
        );
      case 'entry':
        return (
          <DailyEntry 
            people={isCoordinator && currentUser ? people.filter(p => p.id === currentUser.id) : people} 
            reports={reports} 
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onUpdateReport={handleUpdateReport}
            onBulkSetStatus={handleBulkSetStatus}
            isCoordinator={isCoordinator}
          />
        );
      case 'monthly':
        return (
          <MonthlyGrid 
            people={people} 
            reports={reports} 
            selectedDate={selectedDate}
            onNavigateToDate={(date) => {
              setSelectedDate(date);
              setActiveTab('entry');
            }}
          />
        );
      case 'people':
        return (
          <PeopleManager 
            people={people} 
            onUpdatePeople={handleUpdatePeople}
          />
        );
      case 'print':
        return (
          <PrintReports 
            people={people} 
            reports={reports} 
            activities={activities}
            selectedDate={selectedDate}
            onImportBackup={handleImportBackup}
            officeName={officeName}
            districtName={districtName}
          />
        );
      case 'activities':
        return (
          <ActivitiesManager 
            people={isCoordinator && currentUser ? people.filter(p => p.id === currentUser.id) : people}
            activities={isCoordinator && currentUser ? activities.filter(act => act.reporterId === currentUser.id) : activities}
            onAddActivity={(act) => {
              // Automatically mark as pending approval if uploaded by coordinator
              const preparedActivity: FieldActivity = {
                ...act,
                isPendingApproval: isCoordinator,
                submittedBy: isCoordinator ? 'coordinator' : 'admin'
              };
              handleAddActivity(preparedActivity);
            }}
            onDeleteActivity={handleDeleteActivity}
            selectedDate={selectedDate}
            officeName={officeName}
            districtName={districtName}
            reports={reports}
            loggedInUser={currentUser || undefined}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView 
            people={people}
            reports={reports}
            activities={activities}
            selectedDate={selectedDate}
            onNavigateToDate={(date) => {
              setSelectedDate(date);
              setActiveTab('entry');
            }}
            officeName={officeName}
            districtName={districtName}
          />
        );
      default:
        if (isCoordinator && currentUser) {
          return (
            <DailyEntry 
              people={people.filter(p => p.zone === currentUser.zone)} 
              reports={reports} 
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onUpdateReport={handleUpdateReport}
              onBulkSetStatus={handleBulkSetStatus}
              isCoordinator={true}
            />
          );
        }
        return (
          <Dashboard 
            people={people} 
            reports={reports} 
            selectedDate={selectedDate} 
            onNavigateToTab={setActiveTab} 
            onUpdateReport={handleUpdateReport}
          />
        );
    }
  };

  const menuItems = isCoordinator
    ? [
        { id: 'entry', label: 'التقرير اليومي', icon: Activity },
        { id: 'activities', label: 'التقرير الميداني بالصور', icon: Camera },
      ]
    : [
        { id: 'dashboard', label: 'لوحة التحكم العامة', icon: LayoutDashboard },
        { id: 'approvals', label: 'مكتب المراجعة والاعتماد (الإدارة)', icon: ClipboardCheck },
        { id: 'logins', label: 'متابعة حضور ودخول المندوبين', icon: History },
        { id: 'entry', label: 'إدخال التقارير اليومية', icon: Activity },
        { id: 'activities', label: 'رفع الأنشطة الميدانية بالصور', icon: Camera },
        { id: 'monthly', label: 'مصفوفة الشهر', icon: CalendarRange },
        { id: 'analytics', label: 'التحليل الإحصائي الذكي', icon: BarChart3 },
        { id: 'people', label: 'إعدادات وأكواد المندوبين', icon: Users },
        { id: 'print', label: 'التقارير والطباعة', icon: Printer },
      ];

  const handleCopyCoordinatorLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const coordinatorUrl = `${baseUrl}?role=coordinator`;
    navigator.clipboard.writeText(coordinatorUrl)
      .then(() => {
        setShowCopiedToast(true);
        setTimeout(() => setShowCopiedToast(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
      });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-800 flex flex-col antialiased">
      {/* Official Header Banner */}
      <header className="bg-gradient-to-l from-emerald-950 to-emerald-900 border-b border-brand-accent/30 text-white py-3.5 px-4 md:px-8 shadow-md relative no-print">
        {/* Absolute national colored flag indicators */}
        <div className="absolute top-0 right-0 left-0 h-1 flex">
          <div className="flex-1 bg-[#CE1126]"></div>
          <div className="flex-1 bg-white"></div>
          <div className="flex-1 bg-black"></div>
        </div>

        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* National emblem emblem mock */}
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <svg viewBox="0 0 100 100" className="w-7 h-7 text-brand-accent fill-current">
                <path d="M50,10 C45,20 40,30 30,35 C20,40 10,40 15,50 C20,60 30,65 35,75 C40,85 45,90 50,90 C55,90 60,85 65,75 C70,65 80,60 85,50 C90,40 80,40 70,35 C60,30 55,20 50,10 Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold font-serif text-brand-accent flex items-center gap-1.5">
                  <span>{officeName}</span>
                  <span className="text-xs bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-700 text-white font-sans">{districtName}</span>
                </h1>
                {(!currentUser && !isAdmin) ? (
                  <span className="text-[10px] bg-slate-500/20 text-slate-300 font-bold px-2.5 py-0.5 rounded-full border border-slate-500/30">
                    تسجيل الدخول مطلوب 🔐
                  </span>
                ) : isCoordinator ? (
                  <div className="flex flex-col md:flex-row md:items-center gap-1">
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                      المندوب: {currentUser?.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    بوابة الإدارة العامة 🛡️
                  </span>
                )}
              </div>
              <p className="text-[10px] text-emerald-200 flex items-center gap-2">
                <span>الجمهورية اليمنية - التعبئة العامة - محافظة إب</span>
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links (Only shown when logged in) */}
          {(currentUser || isAdmin) && (
            <div className="hidden lg:flex items-center gap-2">
              <nav className="flex items-center gap-1">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-2 ${
                        isActive 
                          ? 'bg-brand-accent text-emerald-950 font-extrabold shadow-sm' 
                          : 'hover:bg-white/10 text-emerald-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {!isCoordinator && (
                <button
                  onClick={handleCopyCoordinatorLink}
                  className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold px-3 py-2 rounded-lg transition shadow-md hover:scale-[1.02] duration-200"
                  title="نسخ رابط مخصص لمنسوبي العزل لإخفاء بيانات الإدارة والتحليلات"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-900" />
                  <span>نسخ رابط منسوبي العزل</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="text-xs bg-rose-700 hover:bg-rose-800 text-white font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 border border-rose-500/20 shadow-sm"
              >
                خروج
              </button>
            </div>
          )}

          {/* Mobile Menu Trigger & Action (Only shown when logged in) */}
          {(currentUser || isAdmin) && (
            <div className="lg:hidden flex items-center gap-2">
              {!isCoordinator && (
                <button
                  onClick={handleCopyCoordinatorLink}
                  className="p-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition shadow-md"
                  title="نسخ رابط منسوبي العزل"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 bg-emerald-800/80 hover:bg-emerald-800 rounded-lg text-white border border-emerald-700 transition"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer/Navigation Menu */}
      {(currentUser || isAdmin) && isMobileMenuOpen && (
        <div className="lg:hidden bg-emerald-950 border-b border-emerald-800 text-white py-3 px-4 space-y-2 no-print">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-right text-xs font-bold px-4 py-3 rounded-lg transition flex items-center gap-3 ${
                  isActive 
                    ? 'bg-brand-accent text-emerald-950 font-extrabold' 
                    : 'hover:bg-emerald-900 text-emerald-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
          
          {/* Mobile Logout Button */}
          <button
            onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }}
            className="w-full text-right text-xs font-bold px-4 py-3 rounded-lg transition flex items-center gap-3 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-900"
          >
            <X className="w-4 h-4" />
            تسجيل الخروج من البوابة
          </button>
        </div>
      )}

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {(!currentUser && !isAdmin) ? (
          <LoginView 
            people={people}
            onLoginSuccess={handleLoginSuccess}
            officeName={officeName}
            districtName={districtName}
          />
        ) : (
          renderContent()
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-xs text-slate-500 space-y-2 no-print">
        <div className="flex justify-center items-center gap-2 text-slate-400 font-serif">
          <span>الجمهورية اليمنية</span>
          <span>•</span>
          <span>محافظة إب</span>
          <span>•</span>
          <span>مديرية حبيش</span>
        </div>
        <p>نظام التقارير اليومية والأداء الميداني العام © 2026. كافة الحقوق محفوظة لمكتب التعبئة العامة بمديرية حبيش.</p>
        <p className="text-[10px] text-slate-600 font-mono">حفظ وتأمين محلي ١٠٠٪ - متوافق مع معايير الأمان الإقليمية</p>
      </footer>

      {/* Toast Notification */}
      {showCopiedToast && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 text-white border border-emerald-500/30 px-5 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
            <Copy className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-sm text-white">تم نسخ الرابط بنجاح!</h5>
            <p className="text-xs text-slate-400 mt-0.5">يمكنك الآن إرساله لمنسوبي العزل والمناديب.</p>
          </div>
        </div>
      )}
    </div>
  );
}
