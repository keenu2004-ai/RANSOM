import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from './AuthContext';

export interface SessionData {
  id: string;
  check_in: string;
  check_out: string | null;
  punch_in_lat: number | string | null;
  punch_in_lng: number | string | null;
  punch_in_accuracy: number | string | null;
  punch_in_location_name?: string | null;
  punch_out_lat: number | string | null;
  punch_out_lng: number | string | null;
  punch_out_accuracy: number | string | null;
  punch_out_location_name?: string | null;
  status: string;
}

export interface TodaySummary {
  date: string;
  activeSession: SessionData | null;
  sessions: SessionData[];
  totalSessions: number;
  totalWorkingHours: number;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  status: string;
}

interface AttendanceContextType {
  todaySummary: TodaySummary | null;
  loading: boolean;
  actionLoading: boolean;
  gpsError: string | null;
  refreshAttendance: () => Promise<void>;
  handlePunch: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const getGPSLocation = (): Promise<{ latitude?: number; longitude?: number; accuracy?: number }> => {
    setGpsError(null);
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsError('Browser geolocation is not supported.');
        resolve({});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        (err) => {
          let msg = 'Location request failed.';
          if (err.code === err.PERMISSION_DENIED) msg = 'Location permission denied.';
          else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Location unavailable.';
          else if (err.code === err.TIMEOUT) msg = 'Location request timed out.';
          setGpsError(msg);
          resolve({});
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const refreshAttendance = useCallback(async () => {
    if (!user || !user.employeeId) {
      setTodaySummary(null);
      return;
    }
    setLoading(true);
    try {
      const todayRes = await apiFetch('/attendance/today').catch(() => null);
      const summaryData = todayRes?.summary || todayRes?.data?.summary;
      const attData = todayRes?.attendance || todayRes?.data?.attendance;
      if (summaryData) {
        setTodaySummary(summaryData);
      } else if (attData) {
        setTodaySummary({
          date: new Date().toISOString().split('T')[0],
          activeSession: attData.check_out ? null : attData,
          sessions: [attData],
          totalSessions: 1,
          totalWorkingHours: parseFloat(attData.working_hours || 0),
          firstCheckIn: attData.check_in,
          lastCheckOut: attData.check_out,
          status: attData.check_out ? 'COMPLETED' : 'ACTIVE'
        });
      } else {
        setTodaySummary(null);
      }
    } catch (err) {
      console.error('Error refreshing attendance in context:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshAttendance();
  }, [refreshAttendance]);

  const handlePunch = async () => {
    if (!user?.employeeId) {
      alert('Your account is not linked to an employee profile. Attendance punching requires an employee profile.');
      return;
    }
    setActionLoading(true);
    try {
      const gps = await getGPSLocation();
      const endpoint = todaySummary?.activeSession ? '/attendance/check-out' : '/attendance/check-in';
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(gps)
      });
      await refreshAttendance();
    } catch (err: any) {
      alert(err.message || 'Attendance action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AttendanceContext.Provider value={{ todaySummary, loading, actionLoading, gpsError, refreshAttendance, handlePunch }}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    return {
      todaySummary: null,
      loading: false,
      actionLoading: false,
      gpsError: null,
      refreshAttendance: async () => {},
      handlePunch: async () => {}
    };
  }
  return context;
};
