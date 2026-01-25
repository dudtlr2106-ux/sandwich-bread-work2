import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command, currentSchedule, weekDateKeys } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // 전체 근무자 명단
    const ALL_WORKERS = [
      "김영식", "김광시", "서민성", "백승빈", "장영광", "연명옥", "이상민",
      "박노일", "강윤묵", "김용주", "김순기", "윤기은", "오세홍", "고장윤"
    ];

    const systemPrompt = `당신은 근무표 관리 AI 어시스턴트입니다. 사용자의 자연어 명령을 분석하여 근무표 변경 사항을 JSON 형식으로 반환합니다.

현재 근무표 구조:
- 부서: foreman(반장), equipment(설비), inspection(검사), logistics(물류)
- 조: A(초반 06-14시), B(중반 14-22시)
- 요일: 월, 화, 수, 목, 금, 토, 일

A조 구성원: 김영식(반장), 김광시, 서민성, 백승빈, 장영광, 연명옥, 이상민
B조 구성원: 박노일(반장), 강윤묵, 김용주, 김순기, 윤기은, 오세홍, 고장윤

명령 유형:
1. 조 스왑: "초반조를 중반조로 변경" - A조와 B조 전체를 교환
2. 로테이션: "이번 주 초반조를 다음 주에는 중반조로" - 조 전체 전환
3. 개별 규칙: "이승연의 퇴근 시간을 30분 일찍 설정" - 특정 인물의 근무 변경
4. 인원 이동: "김광시를 설비로 이동" - 부서 변경

응답 형식 (반드시 JSON):
{
  "understood": true/false,
  "action": "swap_shifts" | "rotate_next_week" | "individual_change" | "move_worker" | "unknown",
  "description": "수행할 작업 설명",
  "changes": {
    "swapShifts": boolean (A조와 B조 스왑 시 true),
    "workerMoves": [{ "worker": "이름", "fromDept": "부서", "toDept": "부서", "fromShift": "A/B", "toShift": "A/B" }],
    "individualChanges": [{ "worker": "이름", "type": "early_leave" | "late_start" | "vacation" | "overtime", "value": "값" }]
  },
  "interpretation": {
    "targetGroup": "A조" | "B조" | "전체" | "개별",
    "ruleType": "로테이션" | "조 스왑" | "인원 이동" | "개별 변경" | "기타",
    "affectedWorkers": ["이름1", "이름2"],
    "details": "규칙에 대한 상세 설명"
  },
  "message": "사용자에게 보여줄 메시지"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `현재 근무표 데이터:\n${JSON.stringify(currentSchedule, null, 2)}\n\n사용자 명령: ${command}` 
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다. 워크스페이스에 크레딧을 추가해주세요." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI 처리 중 오류가 발생했습니다." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // JSON 파싱 시도
    let result;
    try {
      // JSON 블록 추출 (```json ... ``` 형태 처리)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      result = {
        understood: false,
        action: "unknown",
        description: "명령을 이해하지 못했습니다.",
        changes: {},
        message: content || "죄송합니다. 명령을 이해하지 못했습니다. 다시 시도해주세요.",
      };
    }

    // 이름 검증: 명령에 언급된 이름이 실제 근무자 명단에 있는지 확인
    const nameWarnings: string[] = [];
    const mentionedWorkers: string[] = [];

    // workerMoves에서 이름 추출
    if (result.changes?.workerMoves) {
      result.changes.workerMoves.forEach((move: { worker: string }) => {
        if (move.worker) mentionedWorkers.push(move.worker);
      });
    }

    // individualChanges에서 이름 추출
    if (result.changes?.individualChanges) {
      result.changes.individualChanges.forEach((change: { worker: string }) => {
        if (change.worker) mentionedWorkers.push(change.worker);
      });
    }

    // interpretation.affectedWorkers에서 이름 추출
    if (result.interpretation?.affectedWorkers) {
      mentionedWorkers.push(...result.interpretation.affectedWorkers);
    }

    // 중복 제거 후 검증
    const uniqueWorkers = [...new Set(mentionedWorkers)];
    uniqueWorkers.forEach((name) => {
      if (!ALL_WORKERS.includes(name)) {
        // 유사 이름 찾기
        const similarName = ALL_WORKERS.find((w) => 
          w.includes(name) || name.includes(w) || 
          (name.length >= 2 && w.startsWith(name.substring(0, 2)))
        );
        if (similarName) {
          nameWarnings.push(`'${name}'은(는) 존재하지 않습니다. 혹시 '${similarName}'을(를) 의미하셨나요?`);
        } else {
          nameWarnings.push(`'${name}'은(는) 근무자 명단에 존재하지 않는 이름입니다.`);
        }
      }
    });

    // 검증 결과 추가
    result.validation = {
      isValid: nameWarnings.length === 0,
      warnings: nameWarnings,
      validWorkersList: ALL_WORKERS,
    };

    // 경고가 있으면 상태를 pending으로 설정
    if (nameWarnings.length > 0) {
      result.ruleStatus = "pending";
    } else if (result.understood) {
      result.ruleStatus = "active";
    } else {
      result.ruleStatus = "error";
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AI schedule manager error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
