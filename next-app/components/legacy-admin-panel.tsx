'use client';
import {useRef} from 'react';
type AdminView='dashboard'|'design'|'galleries'|'categories'|'sessions'|'messages'|'settings';
export function LegacyAdminPanel({initialView='dashboard'}:{initialView?:AdminView}){const frame=useRef<HTMLIFrameElement>(null);function connect(){const doc=frame.current?.contentDocument;if(!doc)return;window.setTimeout(()=>{if(initialView!=='dashboard')doc.querySelector<HTMLElement>(`[data-view="${initialView}"]`)?.click()},300)}return <iframe ref={frame} onLoad={connect} className="legacy-frame" src="/legacy/admin-v2.html" title="Administração — Rangel Santos"/>}
