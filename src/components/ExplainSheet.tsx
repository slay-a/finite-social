import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Article } from '../types';
import { useTheme } from '../context/ThemeContext';
import { callOpenAI, buildSystemPrompt, buildFirstUserMessage, ChatMessage } from '../lib/aiService';
import { OPENAI_API_KEY } from '../lib/config';

interface Props {
  article: Article | null;
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_H } = Dimensions.get('window');

function useTypewriter(text: string, active: boolean) {
  const [displayed, setDisplayed] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || !text) return;
    setDisplayed('');
    let i = 0;
    intervalRef.current = setInterval(() => {
      i += 3;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(intervalRef.current!);
        setDisplayed(text);
      }
    }, 16);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [text, active]);

  return displayed;
}

function Bubble({ msg, isLatestAi }: { msg: { role: string; content: string }; isLatestAi: boolean }) {
  const theme = useTheme();
  const isAi = msg.role === 'assistant';
  const typed = useTypewriter(msg.content, isAi && isLatestAi);
  const displayText = isLatestAi && isAi ? typed : msg.content;

  const bs = useMemo(() => StyleSheet.create({
    wrap: { borderRadius: 16, padding: 14, maxWidth: '92%' },
    aiWrap: { backgroundColor: theme.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, marginBottom: 10 },
    userWrap: { backgroundColor: `${theme.primary}22`, alignSelf: 'flex-end', borderBottomRightRadius: 4, marginBottom: 10 },
    label: { fontSize: 10, fontWeight: '700', color: '#10A37F', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
    text: { fontSize: 14, color: theme.text, lineHeight: 22 },
    userText: { color: theme.textSub },
  }), [theme]);

  return (
    <View style={[bs.wrap, isAi ? bs.aiWrap : bs.userWrap]}>
      {isAi && <Text style={bs.label}>AI</Text>}
      <Text style={[bs.text, !isAi && bs.userText]}>{displayText}</Text>
    </View>
  );
}

function buildCopyPrompt(article: Article): string {
  return `Explain this article in simple terms — like talking to a curious friend. Keep it casual, 3–4 sentences.\n\nArticle: "${article.title}"\n${article.summary ? `Context: ${article.summary}` : ''}`;
}

function NoKeySheet({ article, visible, onClose, slideAnim, catColor }: {
  article: Article | null; visible: boolean; onClose: () => void;
  slideAnim: Animated.Value; catColor: string;
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!article) return;
    await Clipboard.setStringAsync(buildCopyPrompt(article));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const openAi = async (appUrl: string, webUrl: string) => {
    if (!article) return;
    await handleCopy();
    const canOpen = appUrl ? await Linking.canOpenURL(appUrl) : false;
    Linking.openURL(canOpen ? appUrl : webUrl);
  };

  const s = useMemo(() => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: SCREEN_H * 0.55,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5, shadowRadius: 20, elevation: 24,
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 14, fontWeight: '700', color: theme.text },
    headerSub: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
    closeBtn: { padding: 6 },
    appsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, paddingVertical: 14 },
    appBtn: { flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 5 },
    appEmoji: { fontSize: 24 },
    appLabel: { fontSize: 12, fontWeight: '700', color: theme.text },
    actionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
    copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 13 },
    copyBtnText: { fontSize: 14, fontWeight: '700', color: theme.bg },
    shareBtn: { backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  }), [theme]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView edges={['bottom']}>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: `${catColor}25` }]}>
              <Text style={{ fontSize: 18 }}>🧠</Text>
            </View>
            <View style={s.headerText}>
              <Text style={s.headerTitle}>Explain it simply</Text>
              <Text style={s.headerSub}>Paste into your AI app</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={s.appsRow}>
            {[
              { label: 'Claude',     emoji: '🤖', app: 'claude://',  web: 'https://claude.ai' },
              { label: 'ChatGPT',    emoji: '💬', app: 'chatgpt://', web: 'https://chatgpt.com' },
              { label: 'Gemini',     emoji: '✨', app: '',            web: 'https://gemini.google.com' },
              { label: 'Perplexity', emoji: '🔍', app: '',            web: 'https://perplexity.ai' },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={s.appBtn} onPress={() => openAi(a.app, a.web)} activeOpacity={0.8}>
                <Text style={s.appEmoji}>{a.emoji}</Text>
                <Text style={s.appLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
              <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={16} color={copied ? theme.accent : theme.bg} />
              <Text style={s.copyBtnText}>{copied ? 'Prompt copied!' : 'Copy prompt'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shareBtn} onPress={async () => { if (article) Share.share({ message: buildCopyPrompt(article) }); }} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

export default function ExplainSheet({ article, visible, onClose }: Props) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestAiIndex, setLatestAiIndex] = useState(-1);

  const hasKey = !!OPENAI_API_KEY && !OPENAI_API_KEY.includes('YOUR_KEY');
  const catColor = article ? theme.categoryColors[article.category] ?? theme.primary : theme.primary;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !article || !hasKey) return;
    setMessages([]);
    setError(null);
    setLatestAiIndex(-1);
    sendMessage(buildFirstUserMessage(), []);
  }, [visible, article?.id]);

  const sendMessage = async (userText: string, history: ChatMessage[]) => {
    if (!article) return;
    const systemMsg: ChatMessage = { role: 'system', content: buildSystemPrompt(article) };
    const userMsg: ChatMessage = { role: 'user', content: userText };
    const updatedHistory = [...history, userMsg];
    setMessages(updatedHistory);
    setLoading(true);
    setError(null);
    try {
      const reply = await callOpenAI([systemMsg, ...updatedHistory]);
      const withReply: ChatMessage[] = [...updatedHistory, { role: 'assistant', content: reply }];
      setMessages(withReply);
      setLatestAiIndex(withReply.length - 1);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      const msg = e?.message ?? '';
      setError(
        msg.includes('NO_KEY') ? 'API key not configured.' :
        msg.includes('401')    ? 'Invalid API key.' :
        msg.includes('429')    ? 'Too many requests — try again in a moment.' :
        'Could not connect. Check your connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    inputRef.current?.blur();
    await sendMessage(text, messages);
  };

  if (!hasKey) {
    return <NoKeySheet article={article} visible={visible} onClose={onClose} slideAnim={slideAnim} catColor={catColor} />;
  }

  const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      height: SCREEN_H * 0.86,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5, shadowRadius: 20, elevation: 24,
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 14, fontWeight: '700', color: theme.text },
    poweredRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    poweredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10A37F' },
    poweredText: { fontSize: 11, color: theme.textMuted },
    closeBtn: { padding: 6 },
    chatScroll: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 8 },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4 },
    thinkingText: { fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
    errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: `${theme.danger}18`, borderRadius: 10, padding: 12, marginBottom: 10 },
    errorText: { flex: 1, fontSize: 13, color: theme.danger, lineHeight: 18 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border },
    textInput: { flex: 1, backgroundColor: theme.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: theme.text },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnOff: { backgroundColor: theme.border },
  });

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <View style={s.handle} />
            <View style={s.header}>
              <View style={[s.headerIcon, { backgroundColor: `${catColor}25` }]}>
                <Text style={{ fontSize: 18 }}>💬</Text>
              </View>
              <View style={s.headerText}>
                <Text style={s.headerTitle} numberOfLines={1}>{article?.title}</Text>
                <View style={s.poweredRow}>
                  <View style={s.poweredDot} />
                  <Text style={s.poweredText}>AI Explainer</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView ref={scrollRef} style={s.chatScroll} contentContainerStyle={s.chatContent} showsVerticalScrollIndicator={false} keyboardDismissMode="interactive">
              {loading && messages.length === 0 && (
                <View style={s.thinkingRow}>
                  <ActivityIndicator size="small" color="#10A37F" />
                  <Text style={s.thinkingText}>Reading the article...</Text>
                </View>
              )}
              {error && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}
              {messages
                .filter((m, i) => !(i === 0 && m.role === 'user'))
                .map((msg, _, arr) => {
                  const originalIdx = messages.indexOf(msg);
                  return <Bubble key={originalIdx} msg={msg} isLatestAi={originalIdx === latestAiIndex} />;
                })}
              {loading && messages.length > 0 && (
                <View style={s.thinkingRow}>
                  <ActivityIndicator size="small" color="#10A37F" />
                  <Text style={s.thinkingText}>Thinking...</Text>
                </View>
              )}
            </ScrollView>

            <View style={s.inputRow}>
              <TextInput
                ref={inputRef}
                style={s.textInput}
                placeholder="Ask anything about this article..."
                placeholderTextColor={theme.textDim}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!loading}
                multiline={false}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnOff]}
                onPress={handleSend}
                disabled={!input.trim() || loading}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-up" size={15} color={theme.bg} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
