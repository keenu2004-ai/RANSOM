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
  working_hours?: number | string;
  break_duration_mins?: number;
  status: string;
}

export interface TodaySummary {
  date: string;
  activeSession: SessionData | null;
  sessions: SessionData[];
  totalSessions: number;
  totalSessionCount?: number;
  completedSessionCount?: number;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  totalWorkingHours: number;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  status: string;
  leave?: any;
  holiday?: any;
  pendingRegularization?: any;
}

interface AttendanceContextType {
  todaySummary: TodaySummary | null;
  activeSession: SessionData | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  loading: boolean;
  actionLoading: boolean;
  gpsError: string | null;
  refreshAttendance: () => Promise<void>;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
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
      const activeSess = todayRes?.activeSession || todayRes?.data?.activeSession || summaryData?.activeSession;
      const canIn = todayRes?.canCheckIn ?? todayRes?.data?.canCheckIn ?? (summaryData ? summaryData.canCheckIn : (activeSess == null));
      const canOut = todayRes?.canCheckOut ?? todayRes?.data?.canCheckOut ?? (summaryData ? summaryData.canCheckOut : (activeSess != null));

      if (summaryData) {
        setTodaySummary({
          ...summaryData,
          activeSession: activeSess || summaryData.activeSession || null,
          canCheckIn: canIn,
          canCheckOut: canOut
        });
      } else if (attData) {
        setTodaySummary({
          date: new Date().toISOString().split('T')[0],
          activeSession: attData.check_out ? null : attData,
          sessions: [attData],
          totalSessions: 1,
          totalSessionCount: 1,
          completedSessionCount: attData.check_out ? 1 : 0,
          canCheckIn: !!attData.check_out,
          canCheckOut: !attData.check_out,
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

  const checkIn = async () => {
    if (actionLoading) return;
    if (!user?.employeeId) {
      alert('Your account is not linked to an employee profile.');
      return;
    }
    setActionLoading(true);
    try {
      const gps = await getGPSLocation();
      await apiFetch('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(gps)
      });
      await refreshAttendance();
    } catch (err: any) {
      if (err.code === 'ACTIVE_SESSION_EXISTS' || err.message?.includes('active attendance session') || err.message?.includes('active check-in session')) {
        await refreshAttendance();
      } else {
        alert(err.message || 'Check-in failed.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const checkOut = async () => {
    if (actionLoading) return;
    if (!user?.employeeId) {
      alert('Your account is not linked to an employee profile.');
      return;
    }
    setActionLoading(true);
    try {
      const gps = await getGPSLocation();
      await apiFetch('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify(gps)
      });
      await refreshAttendance();
    } catch (err: any) {
      alert(err.message || 'Check-out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePunch = async () => {
    if (todaySummary?.activeSession) {
      await checkOut();
    } else {
      await checkIn();
    }
  };

  const activeSession = todaySummary?.activeSession || null;
  const canCheckIn = todaySummary?.canCheckIn ?? (activeSession == null);
  const canCheckOut = todaySummary?.canCheckOut ?? (activeSession != null);

  return (
    <AttendanceContext.Provider value={{
      todaySummary,
      activeSession,
      canCheckIn,
      canCheckOut,
      loading,
      actionLoading,
      gpsError,
      refreshAttendance,
      checkIn,
      checkOut,
      handlePunch
    }}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    return {
      todaySummary: null,
      activeSession: null,
      canCheckIn: true,
      canCheckOut: false,
      loading: false,
      actionLoading: false,
      gpsError: null,
      refreshAttendance: async () => {},
      checkIn: async () => {},
      checkOut: async () => {},
      handlePunch: async () => {}
    };
  }
  return context;
};
