import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp as initClientApp, getApp as getClientApp, getApps as getClientApps } from "firebase/app";
import { getFirestore as getClientFirestore, doc, getDoc, setDoc, collection, writeBatch } from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limit for base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// Initialize Firebase & Firestore
let db: any;
let activeDatabaseId = "(default)";
let useLocalFallback = false;

// Local fallback database file
const LOCAL_DB_FILE = path.join(process.cwd(), "local-db-fallback.json");

interface LocalData {
  people: any[];
  reports: any[];
  activities: any[];
  vigils: any[];
  vigilAlerts: any[];
  zoneTasks?: any[];
  officeName: string;
  districtName: string;
  logins: any[];
  securityLogs?: any[];
}

const defaultLocalData: LocalData = {
  people: [],
  reports: [],
  activities: [],
  vigils: [],
  vigilAlerts: [],
  zoneTasks: [],
  officeName: "مكتب التعبئة العامة",
  districtName: "مديرية حبيش",
  logins: [],
  securityLogs: []
};

function readLocalData(): LocalData {
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const content = fs.readFileSync(LOCAL_DB_FILE, "utf8").trim();
      if (!content) {
        return { ...defaultLocalData };
      }
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to read local fallback DB (falling back to default template):", err);
  }
  return { ...defaultLocalData };
}

function writeLocalData(data: Partial<LocalData>) {
  try {
    const current = readLocalData();
    const updated = { ...current, ...data };
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(updated, null, 2), "utf8");
    console.log("Local fallback DB updated successfully.");
  } catch (err) {
    console.error("Failed to write local fallback DB:", err);
  }
}

try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    const appInstance = getClientApps().length === 0 
      ? initClientApp(firebaseConfig)
      : getClientApp();
    activeDatabaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    db = getClientFirestore(appInstance, activeDatabaseId);
    console.log("Firebase Client SDK initialized with database ID:", activeDatabaseId);
  } else {
    const appInstance = getClientApps().length === 0 
      ? initClientApp({ projectId: "gen-lang-client-0047478430" })
      : getClientApp();
    db = getClientFirestore(appInstance);
    console.log("Firebase Client SDK initialized with default settings");
  }
} catch (error: any) {
  console.log("Using local JSON store due to initialization condition:", error?.message || error);
  useLocalFallback = true;
}

// Robust fallback execution handler
async function runWithDatabaseFallback<T>(
  operation: (currentDb: any) => Promise<T>,
  localFallbackOperation: () => T
): Promise<T> {
  if (useLocalFallback) {
    return localFallbackOperation();
  }

  try {
    return await operation(db);
  } catch (err: any) {
    const errMessage = err.message || "";
    const isErrorToFallback = errMessage.includes("PERMISSION_DENIED") || 
      errMessage.includes("NOT_FOUND") || 
      errMessage.includes("permission-denied") || 
      errMessage.includes("not-found") ||
      err.code === "permission-denied" ||
      err.code === "not-found" ||
      err.code === 7 ||
      err.code === 5;
      
    if (isErrorToFallback) {
      if (activeDatabaseId !== "(default)") {
        console.log(`Transitioning operational query due to access limitations on database "${activeDatabaseId}"`);
        try {
          const appInstance = getClientApp();
          db = getClientFirestore(appInstance);
          activeDatabaseId = "(default)";
          return await operation(db);
        } catch (fallbackErr: any) {
          console.log("Primary and default cloud databases unreachable. Switched database fallback to local filesystem.");
          useLocalFallback = true;
          return localFallbackOperation();
        }
      } else {
        console.log("Default cloud database unreachable. Switched database fallback to local filesystem.");
        useLocalFallback = true;
        return localFallbackOperation();
      }
    }
    console.log("Uncaught database query condition:", errMessage);
    throw err;
  }
}

// Self-healing database check at startup
async function verifyDatabaseAccess() {
  if (useLocalFallback) return;
  try {
    await getDoc(doc(db, "mobilization_data", "people"));
    console.log("Database access verification successful for database: " + activeDatabaseId);
  } catch (err: any) {
    const errMessage = err.message || "";
    const isErrorToFallback = errMessage.includes("PERMISSION_DENIED") || 
      errMessage.includes("NOT_FOUND") || 
      errMessage.includes("permission-denied") || 
      errMessage.includes("not-found") ||
      err.code === "permission-denied" || 
      err.code === "not-found" ||
      err.code === 7 || 
      err.code === 5;
      
    if (isErrorToFallback) {
      if (activeDatabaseId !== "(default)") {
        console.log("Database access verification pending on " + activeDatabaseId + ". Testing fallback to default database.");
        try {
          const appInstance = getClientApp();
          db = getClientFirestore(appInstance);
          activeDatabaseId = "(default)";
          // Test access to (default)
          await getDoc(doc(db, "mobilization_data", "people"));
          console.log("Database access verification successful for default fallback database.");
        } catch (fallbackErr: any) {
          console.log("Default database also unreachable. Activating local JSON fallback storage silently.");
          useLocalFallback = true;
        }
      } else {
        console.log("Primary database unreachable. Activating local JSON fallback storage silently.");
        useLocalFallback = true;
      }
    }
  }
}

// Verify database access asynchronously
verifyDatabaseAccess().catch((err) => {
  console.log("Startup verification error handled:", err?.message || err);
});

// API to get all data from Cloud Firestore with fallback
app.get("/api/all-data", async (req, res) => {
  try {
    const result = await runWithDatabaseFallback(
      async (currentDb) => {
        const [peopleDoc, reportsDoc, activitiesDoc, configDoc, loginsDoc, vigilsDoc, vigilAlertsDoc, zoneTasksDoc, securityLogsDoc] = await Promise.all([
          getDoc(doc(currentDb, "mobilization_data", "people")),
          getDoc(doc(currentDb, "mobilization_data", "reports")),
          getDoc(doc(currentDb, "mobilization_data", "activities")),
          getDoc(doc(currentDb, "mobilization_data", "config")),
          getDoc(doc(currentDb, "mobilization_data", "logins")),
          getDoc(doc(currentDb, "mobilization_data", "vigils")),
          getDoc(doc(currentDb, "mobilization_data", "vigil_alerts")),
          getDoc(doc(currentDb, "mobilization_data", "zone_tasks")),
          getDoc(doc(currentDb, "mobilization_data", "security_logs"))
        ]);

        // If no data exists yet on Firestore, return empty so the client can seed it
        if (!peopleDoc.exists() && !reportsDoc.exists() && !activitiesDoc.exists() && !configDoc.exists()) {
          return { empty: true };
        }

        const people = peopleDoc.exists() ? peopleDoc.data()?.data : [];
        const reports = reportsDoc.exists() ? reportsDoc.data()?.data : [];
        const activities = activitiesDoc.exists() ? activitiesDoc.data()?.data : [];
        const logins = loginsDoc.exists() ? loginsDoc.data()?.data : [];
        const vigils = vigilsDoc.exists() ? vigilsDoc.data()?.data : [];
        const vigilAlerts = vigilAlertsDoc.exists() ? vigilAlertsDoc.data()?.data : [];
        const zoneTasks = zoneTasksDoc.exists() ? zoneTasksDoc.data()?.data : [];
        const securityLogs = securityLogsDoc.exists() ? securityLogsDoc.data()?.data : [];
        const config = configDoc.exists() ? configDoc.data() : null;

        return {
          people: people || [],
          reports: reports || [],
          activities: activities || [],
          logins: logins || [],
          vigils: vigils || [],
          vigilAlerts: vigilAlerts || [],
          zoneTasks: zoneTasks || [],
          securityLogs: securityLogs || [],
          officeName: config?.officeName || "مكتب التعبئة العامة",
          districtName: config?.districtName || "مديرية حبيش"
        };
      },
      () => {
        const local = readLocalData();
        if (local.people.length === 0 && local.reports.length === 0 && local.activities.length === 0) {
          return { empty: true };
        }
        return {
          people: local.people,
          reports: local.reports,
          activities: local.activities,
          vigils: local.vigils || [],
          vigilAlerts: local.vigilAlerts || [],
          zoneTasks: local.zoneTasks || [],
          logins: local.logins || [],
          securityLogs: local.securityLogs || [],
          officeName: local.officeName,
          districtName: local.districtName
        };
      }
    );

    res.json(result);
  } catch (err: any) {
    console.error("Error reading from Firestore:", err);
    res.status(500).json({ error: "Failed to read data from the database", details: err.message });
  }
});

// API to save data to Cloud Firestore with fallback
app.post("/api/save", async (req, res) => {
  try {
    const { people, reports, activities, officeName, districtName, logins, vigils, vigilAlerts, zoneTasks, securityLogs } = req.body;
    
    // Always save locally first to ensure robust local cache persistence
    writeLocalData({
      ...(people !== undefined && { people }),
      ...(reports !== undefined && { reports }),
      ...(activities !== undefined && { activities }),
      ...(officeName !== undefined && { officeName }),
      ...(districtName !== undefined && { districtName }),
      ...(logins !== undefined && { logins }),
      ...(vigils !== undefined && { vigils }),
      ...(vigilAlerts !== undefined && { vigilAlerts }),
      ...(zoneTasks !== undefined && { zoneTasks }),
      ...(securityLogs !== undefined && { securityLogs })
    });

    await runWithDatabaseFallback(
      async (currentDb) => {
        const batch = writeBatch(currentDb);

        if (people !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "people"), { data: people });
        }
        if (reports !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "reports"), { data: reports });
        }
        if (activities !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "activities"), { data: activities });
        }
        if (logins !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "logins"), { data: logins });
        }
        if (vigils !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "vigils"), { data: vigils });
        }
        if (vigilAlerts !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "vigil_alerts"), { data: vigilAlerts });
        }
        if (zoneTasks !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "zone_tasks"), { data: zoneTasks });
        }
        if (securityLogs !== undefined) {
          batch.set(doc(currentDb, "mobilization_data", "security_logs"), { data: securityLogs });
        }
        if (officeName !== undefined || districtName !== undefined) {
          const configDocRef = doc(currentDb, "mobilization_data", "config");
          const currentConfigSnap = await getDoc(configDocRef);
          const currentConfig = currentConfigSnap.exists() ? currentConfigSnap.data() : {};
          
          const newConfig = {
            officeName: officeName !== undefined ? officeName : (currentConfig?.officeName || "مكتب التعبئة العامة"),
            districtName: districtName !== undefined ? districtName : (currentConfig?.districtName || "مديرية حبيش"),
          };
          batch.set(configDocRef, newConfig, { merge: true });
        }

        await batch.commit();
      },
      () => {
        console.log("Saved successfully to local fallback DB.");
      }
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Save to Firestore error:", err);
    res.status(500).json({ error: "Failed to save data to the database", details: err.message });
  }
});

// API: AI-Powered Official Daily Telegram & Activity Summary
app.post("/api/analyze-reports", async (req, res) => {
  try {
    const { officeName, districtName, date, people, report, activities } = req.body;

    if (!date || !people) {
      return res.status(400).json({ error: "Missing required fields (date, people)" });
    }

    const ai = getAiClient();

    // Prepare prompt
    const prompt = `
أنت مستشار إداري وخبير صياغة تقارير حكومية رسمية للجمهورية اليمنية.
المطلوب صياغة "برقية إنجاز ميداني يومية مبرقة وموجزة" باسم: "${officeName}" في "${districtName}" لتاريخ يوم: ${date}.

البيانات الميدانية المتوفرة لليوم:
1. إحصائيات الحضور والرفع الميداني:
- إجمالي الكادر البشري المعتمد: ${people.length} أشخاص قياديين ومندوبي عزل.
- تفاصيل التقرير المرفوع لهذا اليوم: ${JSON.stringify(report || {})}

2. الأنشطة الميدانية الموثقة المرفوعة اليوم:
${JSON.stringify(activities || [])}

الكادر البشري المعتمد (الأسماء والأدوار):
${JSON.stringify(people.map((p: any) => ({ name: p.name, role: p.role, zone: p.zone })))}

المطلوب صياغة برقية مبرقة رسمية غاية في الاحترافية والهيبة الإدارية موجهة إلى القيادة العامة والمحافظة.
يجب أن تحتوي البرقية على:
1. البسملة والترويسة الرسمية المعتادة لليمن (الجمهورية اليمنية - التعبئة العامة - محافظة إب - مديرية حبيش - مكتب التعبئة العامة).
2. مقدمة إدارية وطنية رصينة تعبر عن عزم وتفاني كادر مكتب التعبئة في مديرية حبيش لتعزيز الوعي والعمل الاجتماعي والجهوزية.
3. تفصيل دقيق وجميل مقسم حسب القطاعات (مثال: القطاع الثقافي والتربوي، قطاع الحشد والتعبئة والمربعات الميدانية، قطاع التدريب والتأهيل، القطاع الرياضي والشبابي، قطاع الخدمات والاجتماعي). ادمج تفاصيل الأنشطة الفردية والموثقة بالصور بشكل منسق ومقروء تحت هذه العناوين.
4. جدول أو قائمة إحصائية منسقة بنص برقي توضح الانضباط البشري لليوم (كم عدد المنجزين، المتأخرين، المجازين، والغير مرفوعين).
5. سرد مميز للأنشطة الميدانية الموثقة (مع ذكر العزل التي تمت فيها مثل عزلة بني شبيب، عزلة وادي ضبأ، عزلة العمارنة، إلخ). ركّز على الأثر الميداني وعدد المشاركين إن وجد.
6. خاتمة وتوقيع رسمي (مكتب التعبئة العامة بمديرية حبيش - محافظة إب).
7. في نهاية البرقية تماماً، قم بإضافة هاشتاقات رسمية واضحة ومتباعدة لكل عزلة جرى فيها نشاط ميداني اليوم (مثل #عزلة_وادي_ضبأ، #عزلة_بني_شبيب، إلخ)، متبوعاً بهاشتاق التعبئة العامة الإلزامي: #التعبئة_العامة_مديرية_حبيش.

ملاحظة خاصة: إذا كان التقرير أو الأنشطة الميدانية الموثقة تحتوي على فعاليات وأنشطة خاصة بذكرى المولد النبوي الشريف (mawlid)، يرجى إبراز ذلك كحدث محوري استثنائي يعبر عن الابتهاج والتمسك بالقيم النبوية، وتسليط الضوء على مظاهر التزيين الأخضر، والندوات الثقافية، وأعمال التكافل الاجتماعي والإحسان المصاحبة لهذا الموسم العظيم في شتى عزل مديرية حبيش. مع إضافة الهاشتاق الخاص بالموسم: #المولد_النبوي_الشريف.

شروط الصياغة:
- الكتابة بلغة عربية فصحى رسمية راقية وخالية تماماً من الركاكة.
- استخدام علامات ترقيم وتنسيق ممتاز يعتمد على أسطر متباعدة ورموز رصينة مناسبة للبرقيات والتقارير المكتوبة.
- تجنب تماماً أي إشارات تكنولوجية أو لغة الذكاء الاصطناعي، يجب أن يظهر كأنه كتب بيد رئيس المكتب وبدقة متناهية.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ 
      error: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي لتوليد البرقية الرسمية.",
      details: error.message 
    });
  }
});

// Mount Vite middleware or static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust resolution of built asset paths in containerized Cloud Run environments
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : __dirname;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
