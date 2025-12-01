
import React, { useState } from 'react';
import { Card, Button, Icons } from '../components/UI';
import { SQL_SETUP_SCRIPT } from '../constants';

interface SetupProps {
  errorType?: string;
  onSkip?: () => void;
}

export const Setup: React.FC<SetupProps> = ({ errorType, onSkip }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const isConnectionError = errorType === 'CONNECTION_ERROR';
  const isSchemaError = errorType === 'SCHEMA_MISMATCH';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl border-t-4 border-nepaliRed">
        <div className="text-center mb-6">
          <div className="bg-red-100 p-3 rounded-full inline-block mb-4">
            <Icons.Alert className="w-10 h-10 text-nepaliRed" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
             {isConnectionError ? "Connection Failed" : isSchemaError ? "Database Update Required" : "Database Setup Required"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isConnectionError 
              ? "Could not connect to the Supabase database." 
              : isSchemaError
              ? "Your database exists but is missing the new 'Interests' column."
              : "The database is connected, but the required tables are missing."}
          </p>
        </div>

        {isConnectionError ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-sm text-orange-800">
                <strong>Troubleshooting:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Project Paused:</strong> Free Supabase projects pause after inactivity. Go to your Dashboard and click "Restore Project".</li>
                    <li><strong>Ad Blockers:</strong> Disable ad blockers or privacy extensions (like Ghostery) that might block Supabase requests.</li>
                    <li><strong>Internet:</strong> Check your internet connection.</li>
                </ul>
            </div>
        ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside text-sm text-blue-700 space-y-2">
                <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold">Supabase Dashboard</a>.</li>
                <li>Click on the <strong>SQL Editor</strong> icon (left sidebar).</li>
                <li>Click <strong>New Query</strong>.</li>
                <li>Copy the code below, paste it into the editor, and click <strong>Run</strong>.</li>
              </ol>
            </div>
        )}

        {!isConnectionError && (
            <div className="relative mb-6">
              <pre className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto text-xs h-64 shadow-inner">
                {SQL_SETUP_SCRIPT}
              </pre>
              <button 
                onClick={copyToClipboard}
                className="absolute top-2 right-2 bg-white text-gray-800 px-3 py-1 rounded text-xs font-bold shadow hover:bg-gray-100 flex items-center gap-1"
              >
                {copied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
        )}

        <div className="text-center space-y-3">
          {isConnectionError && onSkip && (
             <Button onClick={onSkip} fullWidth variant="primary" className="bg-nepaliRed hover:bg-red-700">
                Enter Offline Mode (Demo)
             </Button>
          )}
          
          <Button onClick={handleRetry} fullWidth variant={isConnectionError ? 'outline' : 'primary'}>
            {isConnectionError ? 'Retry Connection' : 'I have run the script, Retry'}
          </Button>
          
          <p className="text-xs text-gray-400 mt-2">
             {isConnectionError 
                ? "Offline mode allows you to view the UI, but Login/Signup won't work." 
                : "If you still see this screen after running the script, try waiting 10 seconds and refreshing."}
          </p>
        </div>
      </Card>
    </div>
  );
};
