import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbTask } from '../../types/database';
import { TaskAssignee } from '../../types';

export const listTasks = async (coupleId: string): Promise<DbTask[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbTask[]) ?? [];
};

export const createTask = async (input: {
  coupleId: string;
  createdBy: string;
  title: string;
  description: string;
  points: number;
  assignee: TaskAssignee;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('tasks').insert({
    couple_id: input.coupleId,
    created_by: input.createdBy,
    title: input.title,
    description: input.description,
    points: input.points,
    assignee: input.assignee,
  });
  if (error) throw new ServiceError(error.message);
};

// Marks a task completed, logs it as an action, and applies its points (RPC: complete_task).
export const completeTask = async (taskId: string): Promise<DbTask> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('complete_task', { p_task_id: taskId });
  if (error) throw new ServiceError(error.message);
  return data as DbTask;
};
