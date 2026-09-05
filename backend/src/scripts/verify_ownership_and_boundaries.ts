import { AttendanceStatusService } from '../services/attendanceStatusService';

async function testAttendanceBoundaries() {
    console.log("--- TESTING ATTENDANCE BOUNDARIES ---");
    const testCases = [
        { time: "2026-09-01T09:14:59+05:30", expected: "PRESENT" },
        { time: "2026-09-01T09:15:00+05:30", expected: "LATE_PRESENT" },
        { time: "2026-09-01T09:20:00+05:30", expected: "LATE_PRESENT" },
        { time: "2026-09-01T09:29:59+05:30", expected: "LATE_PRESENT" },
        { time: "2026-09-01T09:30:00+05:30", expected: "SHORT_LEAVE" },
        { time: "2026-09-01T10:30:00+05:30", expected: "SHORT_LEAVE" },
        { time: "2026-09-01T10:59:59+05:30", expected: "SHORT_LEAVE" },
        { time: "2026-09-01T11:00:00+05:30", expected: "HALF_DAY" },
        { time: "2026-09-01T12:59:59+05:30", expected: "HALF_DAY" },
        { time: "2026-09-01T13:00:00+05:30", expected: "ABSENT" }
    ];

    let passed = 0;
    for (const tc of testCases) {
        const cat = AttendanceStatusService.getPunctualityCategory(tc.time);
        if (cat === tc.expected) {
            console.log(`[PASS] ${tc.time} -> ${cat}`);
            passed++;
        } else {
            console.error(`[FAIL] ${tc.time} -> Expected ${tc.expected}, got ${cat}`);
        }
    }
    console.log(`Attendance Boundary Results: ${passed}/${testCases.length} Passed`);
}

async function runAll() {
    await testAttendanceBoundaries();
}

runAll().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
