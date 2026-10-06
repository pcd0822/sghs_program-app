import { collection, limit, orderBy, query, type Timestamp } from 'firebase/firestore';
import { useQueryDocs } from '@/data/live';
import { db } from '@/lib/firebase';
import { formatDateTime } from '@/lib/format';
import { Pill } from '@/ui/Pill';
import { Card, Empty, PageHead, TableWrap } from '../ui';

interface Log {
  at: Timestamp | null;
  ip: string;
  device: string;
  userAgent: string;
  codeHint: string;
  locked: boolean;
}

/** 관리자(교사) 로그인 실패 기록 — 코드 추측 시도를 살펴본다 */
export default function LogsPage() {
  const logs = useQueryDocs<Log>('admin-logs', () => query(collection(db, 'adminLoginLogs'), orderBy('at', 'desc'), limit(200)));
  const lockedCount = (logs ?? []).filter((l) => l.locked).length;
  return (
    <div className="space-y-4">
      <PageHead emoji="🔐" title="로그인 실패 기록" desc="교사 코드 로그인 실패 최근 200건. 같은 기기 5번 실패 → 5분 잠금, 같은 IP 1시간 30번 초과 → 30분 잠금." />
      <Card>
        {!logs ? (
          <div className="h-40 animate-pulse rounded-2xl bg-soft" />
        ) : logs.length === 0 ? (
          <Empty emoji="🛡️" text="실패 기록이 없어요" />
        ) : (
          <>
            <p className="mb-2 text-[14px] text-sub">잠금으로 이어진 실패 {lockedCount}건</p>
            <TableWrap>
              <thead>
                <tr>
                  <th>시각</th>
                  <th>IP</th>
                  <th>기기</th>
                  <th>입력(앞 2자리)</th>
                  <th>잠금</th>
                  <th>브라우저</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id}>
                    <td className="whitespace-nowrap">{l.at ? formatDateTime(l.at.toMillis()) : ''}</td>
                    <td className="font-mono text-[13px]">{l.ip}</td>
                    <td className="font-mono text-[12px] text-sub">{l.device}</td>
                    <td className="font-mono">{l.codeHint}</td>
                    <td>{l.locked ? <Pill tone="red">잠금</Pill> : ''}</td>
                    <td className="max-w-[280px] truncate text-[12px] text-sub">{l.userAgent}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        )}
      </Card>
    </div>
  );
}
