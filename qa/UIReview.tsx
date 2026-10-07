"use client";
import { useState } from "react";
import { Dashboard } from "@/components/chain/Dashboard";
import { reviewProps } from "@/qa/review-fixture";
import type { Language, Tab } from "@/lib/types";
export default function AuditReview() {
 const [tab,setTab] = useState<Tab>("overview");
 const [language,setLanguage] = useState<Language>("zh");
 const props = reviewProps(language,tab);
 return <Dashboard {...props} onTabChange={setTab} onLanguageChange={setLanguage}/>;
}
