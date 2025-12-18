
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../services/dataService';
import { PDFService } from '../services/pdfService';
import { ExcelService } from '../services/excelService';
import { User } from '../types';
import { Check, Search, Save, Camera, XCircle, FileSpreadsheet, Download, Share2 } from 'lucide-react';

interface AttendanceProps {
  mode: 'MANUAL' | 'QR';
  user?: User;
}

export const Attendance: React.FC<AttendanceProps> = ({ mode, user }) => {
  const [students] = useState(DataService.getStudents());
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleAttendance = (id: string) => {
    setPresentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    DataService.saveAttendance({
        date: new Date().toISOString(),
        presentStudentIds: Array.from(presentIds),
        mode: mode,
        totalStudents: students.length
    });
    setSubmitted(true);
  };

  const generatePDF = async () => {
      const doc = await PDFService.createDocument('Attendance Report', user || null);
      
      let y = 50;
      
      // --- Summary ---
      y = PDFService.addSectionHeader(doc, 'Daily Summary', y);
      PDFService.addField(doc, 'Date', new Date().toLocaleDateString(), 15, y);
      PDFService.addField(doc, 'Mode', mode, 60, y);
      PDFService.addField(doc, 'Total Students', students.length.toString(), 110, y);
      PDFService.addField(doc, 'Present', `${presentIds.size} (${Math.round((presentIds.size / students.length) * 100)}%)`, 160, y);
      y += 20;

      // --- Table ---
      y = PDFService.addSectionHeader(doc, 'Attendance Log', y);
      y += 5; // spacing

      // Transform data for table
      const tableData = students.map((s, i) => [
          (i + 1).toString(),
          s.name,
          s.classLevel,
          s.id,
          presentIds.has(s.id) ? 'Present' : 'Absent'
      ]);

      // Custom x positions to ensure alignment
      // Headers: #, Name, Class, ID, Status
      PDFService.drawTable(
          doc, 
          ['#', 'Student Name', 'Class', 'Student ID', 'Status'], 
          tableData, 
          y,
          [15, 25, 85, 115, 160]
      );

      PDFService.addFooter(doc);
      return doc;
  };

  const handleDownloadReport = async () => {
      const doc = await generatePDF();
      doc.save(`Attendance_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleShareReport = async () => {
      const doc = await generatePDF();
      await PDFService.shareFile(doc, `Attendance_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExcelDownload = () => {
    ExcelService.generateAttendanceExcel(students, presentIds, mode, user);
  };

  const startScanner = () => {
    setScanning(true);
    // Use setTimeout to ensure DOM element exists
    setTimeout(() => {
        const html5QrCode = new (window as any).Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        // Use environment facing camera (back camera)
        html5QrCode.start(
            { facingMode: "environment" }, 
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText: string) => {
                // Success callback
                setPresentIds(prev => {
                    // Prevent repeated alerts
                    if (prev.has(decodedText)) return prev;
                    
                    const student = students.find(s => s.id === decodedText);
                    if (student) {
                        // Optional: Vibration or sound here
                        alert(`Marked Present: ${student.name}`);
                        const newSet = new Set(prev);
                        newSet.add(decodedText);
                        return newSet;
                    } else {
                        // alert("Student not found!");
                        return prev;
                    }
                });
            },
            (errorMessage: any) => {
                // Parse error, ignore
            }
        ).catch((err: any) => {
            console.error("Error starting scanner", err);
            setScanning(false);
            alert("Error accessing camera. Please ensure permissions are granted.");
        });
    }, 100);
  };

  const stopScanner = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current.clear();
              scannerRef.current = null;
              setScanning(false);
          }).catch((err: any) => {
              console.error("Failed to stop scanner", err);
              setScanning(false);
          });
      } else {
          setScanning(false);
      }
  };

  useEffect(() => {
      return () => {
          if (scannerRef.current) {
             try {
                scannerRef.current.stop().then(() => {
                    scannerRef.current.clear();
                }).catch(() => {});
             } catch (e) { /* ignore */ }
          }
      };
  }, []);

  if (submitted) {
    return (
        <div className="flex flex-col items-center justify-center h-full space-y-4 animate-fade-in">
            <div className="p-4 bg-green-100 rounded-full">
                <Check className="text-green-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-stone-800">Attendance Saved!</h2>
            <div className="flex space-x-3">
                <button onClick={handleDownloadReport} className="text-white bg-emerald-600 px-4 py-2 rounded hover:bg-emerald-700 shadow-sm flex items-center space-x-1"><Download size={18}/><span>PDF</span></button>
                <button onClick={handleShareReport} className="text-white bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 shadow-sm flex items-center space-x-1"><Share2 size={18}/><span>Share</span></button>
                <button onClick={handleExcelDownload} className="text-white bg-green-700 px-4 py-2 rounded hover:bg-green-800 shadow-sm flex items-center space-x-2"><FileSpreadsheet size={18} /><span>Excel</span></button>
                <button onClick={() => setSubmitted(false)} className="text-stone-600 px-4 py-2 border rounded hover:bg-stone-50">Back</button>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 h-full flex flex-col">
      <div className="p-6 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-xl font-bold text-stone-800">{mode === 'QR' ? 'QR Attendance' : 'Manual Attendance'}</h2>
        </div>
        <div className="flex items-center space-x-2">
            {/* Live PDF/Share Preview Actions */}
            <button onClick={handleShareReport} className="p-2 text-stone-500 hover:text-blue-600 bg-stone-50 rounded-lg" title="Share Current Report"><Share2 size={20}/></button>

            {mode === 'QR' ? (
                 !scanning ? (
                    <button onClick={startScanner} className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 shadow-sm transition-colors">
                        <Camera size={20} /><span>Start Scanner</span>
                    </button>
                 ) : (
                    <button onClick={stopScanner} className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 shadow-sm transition-colors">
                        <XCircle size={20} /><span>Stop Scanner</span>
                    </button>
                 )
            ) : (
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-stone-400" size={20} />
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
            )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
         {mode === 'QR' && scanning && (
             <div className="bg-stone-900 p-0 mb-4 rounded-lg overflow-hidden relative">
                 <div id="reader" className="w-full"></div>
                 <div className="absolute top-2 right-2 text-white text-xs bg-black/50 px-2 py-1 rounded">Rear Camera Active</div>
             </div>
         )}
         <table className="w-full text-left">
             <thead className="bg-stone-50 text-stone-600 font-medium text-sm sticky top-0">
                 <tr><th className="p-4">Status</th><th className="p-4">Name</th><th className="p-4">ID</th><th className="p-4">Class</th></tr>
             </thead>
             <tbody className="divide-y divide-stone-100">
                 {filteredStudents.map(student => {
                     const isPresent = presentIds.has(student.id);
                     return (
                         <tr key={student.id} onClick={() => toggleAttendance(student.id)} className={`cursor-pointer hover:bg-stone-50 transition-colors ${isPresent ? 'bg-emerald-50/50' : ''}`}>
                             <td className="p-4"><div className={`w-6 h-6 rounded border flex items-center justify-center ${isPresent ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{isPresent && <Check size={16} className="text-white" />}</div></td>
                             <td className="p-4 font-medium text-stone-800">{student.name}</td>
                             <td className="p-4 text-stone-500 font-mono text-sm">{student.id}</td>
                             <td className="p-4 text-stone-600">{student.classLevel}</td>
                         </tr>
                     );
                 })}
             </tbody>
         </table>
      </div>
      <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-between items-center">
        <div className="text-stone-600">Present: <span className="font-bold text-stone-900">{presentIds.size}</span> / {students.length}</div>
        <button onClick={handleSubmit} disabled={presentIds.size === 0} className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Save size={20} /><span>Submit</span>
        </button>
      </div>
    </div>
  );
};
