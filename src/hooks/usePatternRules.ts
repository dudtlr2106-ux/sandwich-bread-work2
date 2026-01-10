import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScheduleData } from './useScheduleData';
import { Json } from '@/integrations/supabase/types';

export interface PatternRule {
  id: string;
  command: string;
  action: string;
  description: string;
  changes: {
    swapShifts?: boolean;
    workerMoves?: {
      worker: string;
      fromDept?: string;
      toDept?: string;
      fromShift?: "A" | "B";
      toShift?: "A" | "B";
    }[];
    individualChanges?: {
      worker: string;
      type: "early_leave" | "late_start" | "vacation" | "overtime";
      value?: string;
    }[];
  };
  previous_state: ScheduleData | null;
  applied_at: string;
  applied_by: string | null;
  is_active: boolean;
  created_at: string;
}

export function usePatternRules() {
  const [patternRules, setPatternRules] = useState<PatternRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 패턴 규칙 목록 로드
  const loadPatternRules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pattern_rules')
        .select('*')
        .order('applied_at', { ascending: false });

      if (error) throw error;

      const rules: PatternRule[] = (data || []).map((row) => ({
        id: row.id,
        command: row.command,
        action: row.action,
        description: row.description,
        changes: row.changes as PatternRule['changes'],
        previous_state: row.previous_state as ScheduleData | null,
        applied_at: row.applied_at,
        applied_by: row.applied_by,
        is_active: row.is_active,
        created_at: row.created_at,
      }));

      setPatternRules(rules);
    } catch (error) {
      console.error('Failed to load pattern rules:', error);
      toast.error('패턴 규칙 로드에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadPatternRules();
  }, [loadPatternRules]);

  // 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel('pattern-rules-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pattern_rules' },
        () => {
          loadPatternRules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPatternRules]);

  // 새 패턴 규칙 추가
  const addPatternRule = useCallback(async (
    command: string,
    action: string,
    description: string,
    changes: PatternRule['changes'],
    previousState: ScheduleData | null
  ): Promise<PatternRule | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('pattern_rules')
        .insert({
          command,
          action,
          description,
          changes: changes as unknown as Json,
          previous_state: previousState as unknown as Json,
          applied_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newRule: PatternRule = {
        id: data.id,
        command: data.command,
        action: data.action,
        description: data.description,
        changes: data.changes as PatternRule['changes'],
        previous_state: data.previous_state as ScheduleData | null,
        applied_at: data.applied_at,
        applied_by: data.applied_by,
        is_active: data.is_active,
        created_at: data.created_at,
      };

      return newRule;
    } catch (error) {
      console.error('Failed to add pattern rule:', error);
      toast.error('패턴 규칙 저장에 실패했습니다');
      return null;
    }
  }, []);

  // 패턴 규칙 비활성화 (삭제 대신)
  const deactivatePatternRule = useCallback(async (ruleId: string): Promise<ScheduleData | null> => {
    try {
      // 먼저 해당 규칙의 이전 상태를 가져옴
      const rule = patternRules.find((r) => r.id === ruleId);
      if (!rule) {
        throw new Error('규칙을 찾을 수 없습니다');
      }

      const { error } = await supabase
        .from('pattern_rules')
        .update({ is_active: false })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('패턴 규칙이 비활성화되었습니다');
      
      // 이전 상태 반환 (복구용)
      return rule.previous_state;
    } catch (error) {
      console.error('Failed to deactivate pattern rule:', error);
      toast.error('패턴 규칙 비활성화에 실패했습니다');
      return null;
    }
  }, [patternRules]);

  // 패턴 규칙 재활성화
  const reactivatePatternRule = useCallback(async (ruleId: string): Promise<PatternRule['changes'] | null> => {
    try {
      const rule = patternRules.find((r) => r.id === ruleId);
      if (!rule) {
        throw new Error('규칙을 찾을 수 없습니다');
      }

      const { error } = await supabase
        .from('pattern_rules')
        .update({ is_active: true })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('패턴 규칙이 재활성화되었습니다');
      
      return rule.changes;
    } catch (error) {
      console.error('Failed to reactivate pattern rule:', error);
      toast.error('패턴 규칙 재활성화에 실패했습니다');
      return null;
    }
  }, [patternRules]);

  // 패턴 규칙 완전 삭제
  const deletePatternRule = useCallback(async (ruleId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pattern_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('패턴 규칙이 삭제되었습니다');
      return true;
    } catch (error) {
      console.error('Failed to delete pattern rule:', error);
      toast.error('패턴 규칙 삭제에 실패했습니다');
      return false;
    }
  }, []);

  // 패턴 규칙 수정
  const updatePatternRule = useCallback(async (
    ruleId: string,
    updates: Partial<Pick<PatternRule, 'command' | 'description'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pattern_rules')
        .update(updates)
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('패턴 규칙이 수정되었습니다');
      return true;
    } catch (error) {
      console.error('Failed to update pattern rule:', error);
      toast.error('패턴 규칙 수정에 실패했습니다');
      return false;
    }
  }, []);

  return {
    patternRules,
    isLoading,
    addPatternRule,
    deactivatePatternRule,
    reactivatePatternRule,
    deletePatternRule,
    updatePatternRule,
    refreshPatternRules: loadPatternRules,
  };
}
