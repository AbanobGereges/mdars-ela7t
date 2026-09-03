import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fbf7ee] flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 sm:p-8 border border-rose-200 shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto border border-rose-300 shadow-sm">
              <AlertTriangle size={32} />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-black text-rose-950">حدث خطأ غير متوقع في الواجهة</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                تم التقاط الخطأ بواسطة نظام الحماية (Error Boundary) لمنع الشاشة البيضاء
              </p>
            </div>

            <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 text-xs text-rose-900 font-mono overflow-x-auto max-h-48 text-left" dir="ltr">
              <p className="font-bold text-rose-700">{this.state.error?.toString()}</p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-600 mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 rounded-xl bg-church-600 hover:bg-church-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>إعادة تحميل الصفحة</span>
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-all"
              >
                محاولة المتابعة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
