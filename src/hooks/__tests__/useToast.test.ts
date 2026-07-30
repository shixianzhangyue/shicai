import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('should add a toast when toast() is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast('success', 'Operation successful');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'success',
      message: 'Operation successful',
    });
    expect(result.current.toasts[0].id).toBeDefined();
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast('success', 'First toast');
    });
    act(() => {
      result.current.toast('error', 'Second toast');
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].message).toBe('First toast');
    expect(result.current.toasts[1].message).toBe('Second toast');
  });

  it('should remove a toast when dismiss() is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast('info', 'Toast to dismiss');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should auto-dismiss toast after default duration (3000ms)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast('warning', 'Auto dismiss');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should auto-dismiss toast after custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast('success', 'Custom duration', 1000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should not auto-dismiss when duration is 0', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast('error', 'Persistent toast', 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });
});
