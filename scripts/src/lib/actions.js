"use strict";
// Firebase actions para o cliente (compatível com export estático)
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAttendance = addAttendance;
exports.getAttendanceRecords = getAttendanceRecords;
exports.getTodayAttendance = getTodayAttendance;
exports.updateAttendance = updateAttendance;
exports.deleteAttendance = deleteAttendance;
exports.getAttendanceByRegion = getAttendanceByRegion;
exports.getAttendanceByDateRange = getAttendanceByDateRange;
exports.getAttendanceStats = getAttendanceStats;
exports.getAttendanceReportData = getAttendanceReportData;
exports.getWeeklyAttendanceStats = getWeeklyAttendanceStats;
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("./firebase");
function addAttendance(data) {
    return __awaiter(this, void 0, void 0, function () {
        var cleanCpf, q, snapshot, docRef, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    cleanCpf = (data.cpf || '').replace(/\D/g, '');
                    q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "attendance"), (0, firestore_1.where)("cpf", "==", cleanCpf));
                    return [4 /*yield*/, (0, firestore_1.getDocs)(q)];
                case 1:
                    snapshot = _a.sent();
                    if (!snapshot.empty) {
                        return [2 /*return*/, { success: false, error: "Já existe um registro para este CPF. Não é possível cadastrar novamente." }];
                    }
                    return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, "attendance"), __assign(__assign({}, data), { cpf: cleanCpf, timestamp: firestore_1.Timestamp.now(), createdAt: firestore_1.Timestamp.now() }))];
                case 2:
                    docRef = _a.sent();
                    return [2 /*return*/, { success: true, id: docRef.id }];
                case 3:
                    e_1 = _a.sent();
                    console.error("Error adding document: ", e_1);
                    return [2 /*return*/, { success: false, error: "Falha ao registrar presença. Verifique as configurações do Firebase." }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getAttendanceRecords() {
    return __awaiter(this, void 0, void 0, function () {
        var querySnapshot, records_1, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, firestore_1.getDocs)((0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "attendance"), (0, firestore_1.orderBy)("timestamp", "desc")))];
                case 1:
                    querySnapshot = _a.sent();
                    records_1 = [];
                    querySnapshot.forEach(function (doc) {
                        var data = doc.data();
                        records_1.push(__assign(__assign({ id: doc.id }, data), { timestamp: data.timestamp.toDate() }));
                    });
                    return [2 /*return*/, records_1];
                case 2:
                    e_2 = _a.sent();
                    console.error("Error getting documents: ", e_2);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getTodayAttendance() {
    return __awaiter(this, void 0, void 0, function () {
        var today, tomorrow, q, querySnapshot, records_2, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    today = new Date();
                    today.setHours(0, 0, 0, 0);
                    tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "attendance"), (0, firestore_1.where)("timestamp", ">=", firestore_1.Timestamp.fromDate(today)), (0, firestore_1.where)("timestamp", "<", firestore_1.Timestamp.fromDate(tomorrow)), (0, firestore_1.orderBy)("timestamp", "desc"));
                    return [4 /*yield*/, (0, firestore_1.getDocs)(q)];
                case 1:
                    querySnapshot = _a.sent();
                    records_2 = [];
                    querySnapshot.forEach(function (doc) {
                        var data = doc.data();
                        records_2.push(__assign(__assign({ id: doc.id }, data), { timestamp: data.timestamp.toDate() }));
                    });
                    return [2 /*return*/, records_2];
                case 2:
                    e_3 = _a.sent();
                    console.error("Error getting today's attendance: ", e_3);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function updateAttendance(id, data) {
    return __awaiter(this, void 0, void 0, function () {
        var docRef, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    docRef = (0, firestore_1.doc)(firebase_1.db, "attendance", id);
                    return [4 /*yield*/, (0, firestore_1.updateDoc)(docRef, data)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { success: true }];
                case 2:
                    e_4 = _a.sent();
                    console.error("Error updating document: ", e_4);
                    return [2 /*return*/, { success: false, error: "Falha ao atualizar registro." }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function deleteAttendance(id) {
    return __awaiter(this, void 0, void 0, function () {
        var e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firebase_1.db, "attendance", id))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { success: true }];
                case 2:
                    e_5 = _a.sent();
                    console.error("Error deleting document: ", e_5);
                    return [2 /*return*/, { success: false, error: "Falha ao deletar registro." }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getAttendanceByRegion(region) {
    return __awaiter(this, void 0, void 0, function () {
        var q, querySnapshot, records_3, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "attendance"), (0, firestore_1.where)("region", "==", region), (0, firestore_1.orderBy)("timestamp", "desc"));
                    return [4 /*yield*/, (0, firestore_1.getDocs)(q)];
                case 1:
                    querySnapshot = _a.sent();
                    records_3 = [];
                    querySnapshot.forEach(function (doc) {
                        var data = doc.data();
                        records_3.push(__assign(__assign({ id: doc.id }, data), { timestamp: data.timestamp.toDate() }));
                    });
                    return [2 /*return*/, records_3];
                case 2:
                    e_6 = _a.sent();
                    console.error("Error getting attendance by region: ", e_6);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getAttendanceByDateRange(startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var q, querySnapshot, records_4, e_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "attendance"), (0, firestore_1.where)("timestamp", ">=", firestore_1.Timestamp.fromDate(startDate)), (0, firestore_1.where)("timestamp", "<=", firestore_1.Timestamp.fromDate(endDate)), (0, firestore_1.orderBy)("timestamp", "desc"));
                    return [4 /*yield*/, (0, firestore_1.getDocs)(q)];
                case 1:
                    querySnapshot = _a.sent();
                    records_4 = [];
                    querySnapshot.forEach(function (doc) {
                        var data = doc.data();
                        records_4.push(__assign(__assign({ id: doc.id }, data), { timestamp: data.timestamp.toDate() }));
                    });
                    return [2 /*return*/, records_4];
                case 2:
                    e_7 = _a.sent();
                    console.error("Error getting attendance by date range: ", e_7);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getAttendanceStats() {
    return __awaiter(this, void 0, void 0, function () {
        var today, tomorrow, todayQuery, todaySnapshot, todayRecords_1, present, justified, absent, total, attendanceRate, e_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    today = new Date();
                    today.setHours(0, 0, 0, 0);
                    tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    todayQuery = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "attendance"), (0, firestore_1.where)("timestamp", ">=", firestore_1.Timestamp.fromDate(today)), (0, firestore_1.where)("timestamp", "<", firestore_1.Timestamp.fromDate(tomorrow)));
                    return [4 /*yield*/, (0, firestore_1.getDocs)(todayQuery)];
                case 1:
                    todaySnapshot = _a.sent();
                    todayRecords_1 = [];
                    todaySnapshot.forEach(function (doc) {
                        var data = doc.data();
                        todayRecords_1.push(__assign(__assign({ id: doc.id }, data), { timestamp: data.timestamp.toDate() }));
                    });
                    present = todayRecords_1.filter(function (record) { return record.status === 'Presente'; }).length;
                    justified = todayRecords_1.filter(function (record) { return record.status === 'Justificado'; }).length;
                    absent = todayRecords_1.filter(function (record) { return record.status === 'Ausente'; }).length;
                    total = todayRecords_1.length;
                    attendanceRate = total > 0 ? (present / total) * 100 : 0;
                    return [2 /*return*/, {
                            present: present,
                            justified: justified,
                            absent: absent,
                            total: total,
                            attendanceRate: Math.round(attendanceRate * 100) / 100
                        }];
                case 2:
                    e_8 = _a.sent();
                    console.error("Error getting attendance stats: ", e_8);
                    return [2 /*return*/, {
                            present: 0,
                            justified: 0,
                            absent: 0,
                            total: 0,
                            attendanceRate: 0
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getAttendanceReportData() {
    return __awaiter(this, void 0, void 0, function () {
        var allRecords, totalRecords, presentCount, justifiedCount, absentCount, byShift, byRegion, byPosition, byReclassification, attendanceRate, e_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getAttendanceRecords()];
                case 1:
                    allRecords = _a.sent();
                    totalRecords = allRecords.length;
                    presentCount = allRecords.filter(function (r) { return r.status === 'Presente'; }).length;
                    justifiedCount = allRecords.filter(function (r) { return r.status === 'Justificado'; }).length;
                    absentCount = allRecords.filter(function (r) { return r.status === 'Ausente'; }).length;
                    byShift = {
                        Manhã: allRecords.filter(function (r) { return r.shift === 'Manhã' && r.status === 'Presente'; }).length,
                        Tarde: allRecords.filter(function (r) { return r.shift === 'Tarde' && r.status === 'Presente'; }).length,
                        Noite: allRecords.filter(function (r) { return r.shift === 'Noite' && r.status === 'Presente'; }).length,
                    };
                    byRegion = {
                        Norte: allRecords.filter(function (r) { return r.region === 'Norte' && r.status === 'Presente'; }).length,
                        Sul: allRecords.filter(function (r) { return r.region === 'Sul' && r.status === 'Presente'; }).length,
                        Leste: allRecords.filter(function (r) { return r.region === 'Leste' && r.status === 'Presente'; }).length,
                        Oeste: allRecords.filter(function (r) { return r.region === 'Oeste' && r.status === 'Presente'; }).length,
                        Central: allRecords.filter(function (r) { return r.region === 'Central' && r.status === 'Presente'; }).length,
                    };
                    byPosition = {
                        'Conselheiro(a)': allRecords.filter(function (r) { return r.churchPosition === 'Conselheiro(a)' && r.status === 'Presente'; }).length,
                        'Financeiro(a)': allRecords.filter(function (r) { return r.churchPosition === 'Financeiro(a)' && r.status === 'Presente'; }).length,
                        'Secretário(a)': allRecords.filter(function (r) { return r.churchPosition === 'Secretário(a)' && r.status === 'Presente'; }).length,
                        Pastor: allRecords.filter(function (r) { return r.churchPosition === 'Pastor' && r.status === 'Presente'; }).length,
                        Presbítero: allRecords.filter(function (r) { return r.churchPosition === 'Presbítero' && r.status === 'Presente'; }).length,
                        Diácono: allRecords.filter(function (r) { return r.churchPosition === 'Diácono' && r.status === 'Presente'; }).length,
                        'Dirigente 1': allRecords.filter(function (r) { return r.churchPosition === 'Dirigente 1' && r.status === 'Presente'; }).length,
                        'Dirigente 2': allRecords.filter(function (r) { return r.churchPosition === 'Dirigente 2' && r.status === 'Presente'; }).length,
                        'Dirigente 3': allRecords.filter(function (r) { return r.churchPosition === 'Dirigente 3' && r.status === 'Presente'; }).length,
                        'Cooperador(a)': allRecords.filter(function (r) { return r.churchPosition === 'Cooperador(a)' && r.status === 'Presente'; }).length,
                        Membro: allRecords.filter(function (r) { return r.churchPosition === 'Membro' && r.status === 'Presente'; }).length,
                        Outro: allRecords.filter(function (r) { return r.churchPosition === 'Outro' && r.status === 'Presente'; }).length,
                    };
                    byReclassification = {
                        Local: allRecords.filter(function (r) { return r.reclassification === 'Local' && r.status === 'Presente'; }).length,
                        Setorial: allRecords.filter(function (r) { return r.reclassification === 'Setorial' && r.status === 'Presente'; }).length,
                        Central: allRecords.filter(function (r) { return r.reclassification === 'Central' && r.status === 'Presente'; }).length,
                        'Casa de oração': allRecords.filter(function (r) { return r.reclassification === 'Casa de oração' && r.status === 'Presente'; }).length,
                        Estadual: allRecords.filter(function (r) { return r.reclassification === 'Estadual' && r.status === 'Presente'; }).length,
                        Regional: allRecords.filter(function (r) { return r.reclassification === 'Regional' && r.status === 'Presente'; }).length,
                    };
                    attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
                    return [2 /*return*/, {
                            summary: {
                                total: totalRecords,
                                present: presentCount,
                                justified: justifiedCount,
                                absent: absentCount,
                                attendanceRate: Math.round(attendanceRate * 100) / 100
                            },
                            byShift: byShift,
                            byRegion: byRegion,
                            byPosition: byPosition,
                            byReclassification: byReclassification,
                            records: allRecords
                        }];
                case 2:
                    e_9 = _a.sent();
                    console.error("Error getting report data: ", e_9);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getWeeklyAttendanceStats() {
    return __awaiter(this, void 0, void 0, function () {
        var today, oneWeekAgo, weeklyRecords, dailyStats, _loop_1, i, e_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    today = new Date();
                    oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return [4 /*yield*/, getAttendanceByDateRange(oneWeekAgo, today)];
                case 1:
                    weeklyRecords = _a.sent();
                    dailyStats = [];
                    _loop_1 = function (i) {
                        var date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                        var dayStart = new Date(date.setHours(0, 0, 0, 0));
                        var dayEnd = new Date(date.setHours(23, 59, 59, 999));
                        var dayRecords = weeklyRecords.filter(function (r) {
                            return r.timestamp >= dayStart && r.timestamp <= dayEnd;
                        });
                        var present = dayRecords.filter(function (r) { return r.status === 'Presente'; }).length;
                        var total = dayRecords.length;
                        dailyStats.push({
                            date: dayStart.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
                            present: present,
                            total: total,
                            rate: total > 0 ? Math.round((present / total) * 100) : 0
                        });
                    };
                    for (i = 6; i >= 0; i--) {
                        _loop_1(i);
                    }
                    return [2 /*return*/, dailyStats];
                case 2:
                    e_10 = _a.sent();
                    console.error("Error getting weekly stats: ", e_10);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Funções de gerenciamento de usuários
