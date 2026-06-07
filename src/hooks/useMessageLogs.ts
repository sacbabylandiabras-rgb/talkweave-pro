// @refresh reset
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isGroupPhone,
  isUsableGroupDisplayName,
  isCommunityPhone,
  normalizeConversationPhone,
  rememberGroupDisplayName,
  resolveGroupConversationName,
} from "@/lib/group-name-resolution";
