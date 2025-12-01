
import React, { useEffect, useState } from 'react';
import { User, Report, Match } from '../types';
import { apiGetAdminData, apiBanUser, apiResetAllData } from '../services/mockBackend';
import { Button, Card, Icons } from '../components/UI';
import { SQL_RESET_SCRIPT } from '../constants';

export const Admin: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [data, setData] = useState<{ users: User[], reports: Report[], matches: Match[] } | null>(null);
    const [resetting, setResetting] = useState(false);
    const [showSql, setShowSql] = useState(false);

    const refresh = async () => {
        const d = await apiGetAdminData();
        setData(d);
    };

    useEffect(() => { refresh(); }, []);

    const handleBan = async (uid: string) => {
        if(confirm('Ban this user?')) {
            await apiBanUser(uid);
            refresh();
        }
    };

    const handleReset = async () => {
        const confirm1 = confirm("WARNING: This will delete ALL profiles, matches, and messages.");
        if (!confirm1) return;
        
        const confirm2 = confirm("Are you absolutely sure? Users will be forced to log out.");
        if (!confirm2) return;

        setResetting(true);
        try {
            await apiResetAllData();
            alert("Application data wiped. Logging out.");
            onLogout();
        } catch (e) {
            alert("Reset failed.");
        } finally {
            setResetting(false);
        }
    };

    const copySql = () => {
        navigator.clipboard.writeText(SQL_RESET_SCRIPT);
        alert("SQL Script copied! Run this in Supabase Dashboard -> SQL Editor to delete Auth Users.");
    };

    if (!data) return <div className="p-8">Loading Admin...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
                <Button variant="outline" onClick={onLogout}>Logout</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="text-center">
                    <h3 className="text-gray-500">Total Users</h3>
                    <p className="text-3xl font-bold">{data.users.length}</p>
                </Card>
                <Card className="text-center">
                    <h3 className="text-gray-500">Active Matches</h3>
                    <p className="text-3xl font-bold">{data.matches.filter(m => m.active).length}</p>
                </Card>
                <Card className="text-center">
                    <h3 className="text-gray-500">Reports</h3>
                    <p className="text-3xl font-bold text-red-500">{data.reports.length}</p>
                </Card>
            </div>

            <h2 className="text-xl font-bold mb-4">Recent Reports</h2>
            <div className="bg-white rounded-xl shadow overflow-x-auto mb-8">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4">Reporter</th>
                            <th className="p-4">Target</th>
                            <th className="p-4">Reason</th>
                            <th className="p-4">Time</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.reports.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No reports</td></tr>}
                        {data.reports.map(r => {
                            const reporter = data.users.find(u => u.id === r.reporterUserId)?.displayName || 'Unknown';
                            const target = data.users.find(u => u.id === r.targetUserId);
                            return (
                                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="p-4">{reporter}</td>
                                    <td className="p-4 font-medium">{target?.displayName || 'Unknown'}</td>
                                    <td className="p-4">{r.reason}</td>
                                    <td className="p-4 text-gray-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
                                    <td className="p-4">
                                        {target && !target.isBanned && (
                                            <button onClick={() => handleBan(target.id)} className="text-red-600 font-bold hover:underline">Ban</button>
                                        )}
                                        {target?.isBanned && <span className="text-red-400">Banned</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <h2 className="text-xl font-bold mb-4">All Users</h2>
            <div className="bg-white rounded-xl shadow overflow-x-auto mb-8">
                <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Age</th>
                            <th className="p-4">Email</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.users.map(u => (
                            <tr key={u.id} className="border-b last:border-0">
                                <td className="p-4">{u.displayName}</td>
                                <td className="p-4">{u.role}</td>
                                <td className="p-4">{u.age}</td>
                                <td className="p-4 text-gray-500">{u.email}</td>
                                <td className="p-4">
                                    {u.isBanned ? <span className="text-red-500">Banned</span> : <span className="text-green-600">Active</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* DANGER ZONE */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mt-12">
                <h2 className="text-red-800 font-black text-xl mb-4 flex items-center gap-2">
                    <Icons.Alert className="w-6 h-6" />
                    DANGER ZONE
                </h2>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="flex-1">
                        <p className="text-red-700 text-sm mb-4 font-medium">
                            <strong>Soft Reset:</strong> Clicking the button below will delete all profiles, matches, and messages. Users will be forced to log out. However, their login email/password will still exist in Supabase Auth.
                        </p>
                        <Button variant="danger" onClick={handleReset} isLoading={resetting} className="bg-red-600 text-white hover:bg-red-700 shadow-red-500/30">
                            RESET DATABASE (DELETE ALL USERS)
                        </Button>
                    </div>
                    <div className="flex-1 border-l border-red-200 pl-4">
                        <p className="text-red-700 text-sm mb-4 font-medium">
                            <strong>Hard Reset (Complete Wipe):</strong> To delete the actual login credentials (Auth Users), you must run this SQL script in your Supabase Dashboard.
                        </p>
                        <Button variant="outline" onClick={() => setShowSql(!showSql)} className="border-red-300 text-red-700 hover:bg-red-100">
                            {showSql ? 'Hide SQL' : 'Show SQL Script'}
                        </Button>
                        {showSql && (
                            <div className="mt-4 relative">
                                <pre className="bg-gray-800 text-red-300 p-3 rounded text-xs overflow-x-auto">
                                    {SQL_RESET_SCRIPT}
                                </pre>
                                <button onClick={copySql} className="mt-2 text-xs font-bold text-red-600 hover:underline">Copy to Clipboard</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
