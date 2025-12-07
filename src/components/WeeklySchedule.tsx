import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Wrench, Search, Package } from "lucide-react";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const DAYS_FULL = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];

interface Department {
  id: string;
  name: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  badgeClass: string;
}

const departments: Department[] = [
  {
    id: "equipment",
    name: "설비",
    count: 3,
    icon: <Wrench className="h-4 w-4" />,
    colorClass: "department-equipment",
    badgeClass: "bg-equipment text-primary-foreground",
  },
  {
    id: "inspection",
    name: "검사",
    count: 2,
    icon: <Search className="h-4 w-4" />,
    colorClass: "department-inspection",
    badgeClass: "bg-inspection text-primary-foreground",
  },
  {
    id: "logistics",
    name: "물류",
    count: 1,
    icon: <Package className="h-4 w-4" />,
    colorClass: "department-logistics",
    badgeClass: "bg-logistics text-primary-foreground",
  },
];

type ScheduleData = {
  [key: string]: {
    [key: string]: string[];
  };
};

const WeeklySchedule = () => {
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    equipment: {
      월: ["김철수", "이영희", "박민수"],
      화: ["김철수", "이영희", "박민수"],
      수: ["김철수", "이영희", "박민수"],
      목: ["김철수", "이영희", "박민수"],
      금: ["김철수", "이영희", "박민수"],
      토: ["김철수"],
      일: [],
    },
    inspection: {
      월: ["최지은", "정현우"],
      화: ["최지은", "정현우"],
      수: ["최지은", "정현우"],
      목: ["최지은", "정현우"],
      금: ["최지은", "정현우"],
      토: ["최지은"],
      일: [],
    },
    logistics: {
      월: ["한승민"],
      화: ["한승민"],
      수: ["한승민"],
      목: ["한승민"],
      금: ["한승민"],
      토: [],
      일: [],
    },
  });

  const getDayHeaderClass = (day: string) => {
    if (day === "토") return "text-saturday font-semibold";
    if (day === "일") return "text-sunday font-semibold";
    return "text-foreground font-semibold";
  };

  return (
    <Card className="w-full max-w-6xl mx-auto shadow-lg border-0 bg-card animate-fade-in">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                주간 근무표
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                2024년 12월 첫째 주
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              총 {departments.reduce((acc, d) => acc + d.count, 0)}명
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-4 text-left font-semibold text-foreground border-b border-r border-border min-w-[140px]">
                  부서
                </th>
                {DAYS.map((day, index) => (
                  <th
                    key={day}
                    className={`p-4 text-center border-b border-r border-border min-w-[100px] ${getDayHeaderClass(day)}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{day}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {DAYS_FULL[index]}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                  <td className={`p-4 border-b border-r border-border ${dept.colorClass}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-card shadow-sm">
                        {dept.icon}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground block">
                          {dept.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`mt-1 ${dept.badgeClass} text-xs`}
                        >
                          {dept.count}명
                        </Badge>
                      </div>
                    </div>
                  </td>
                  {DAYS.map((day) => {
                    const workers = scheduleData[dept.id]?.[day] || [];
                    const isWeekend = day === "토" || day === "일";
                    return (
                      <td
                        key={day}
                        className={`schedule-cell border-b ${isWeekend ? "bg-muted/30" : ""}`}
                      >
                        <div className="flex flex-col gap-1">
                          {workers.length > 0 ? (
                            workers.map((worker, idx) => (
                              <span
                                key={idx}
                                className="text-sm text-foreground px-2 py-1 rounded bg-card shadow-sm inline-block"
                              >
                                {worker}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              휴무
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground font-medium">범례:</span>
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${dept.badgeClass}`} />
                <span className="text-foreground">{dept.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklySchedule;
