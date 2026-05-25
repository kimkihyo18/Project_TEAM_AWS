import { Request, Response } from 'express';
import { config, isLocal } from '../config';
import logger from '../utils/logger';

// Bedrock 기반 숙소 추천 (추후 구현)
// 현재는 간단한 인기 순위 기반 추천 반환
export async function getRecommendations(req: Request, res: Response): Promise<void> {
  const { preferences } = req.body;

  if (!isLocal) {
    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
      const client = new BedrockRuntimeClient({ region: config.cognito.region });

      const prompt = `당신은 여행 전문가입니다. 사용자 선호도: ${JSON.stringify(preferences)}
        이를 바탕으로 한국 내 여행지 및 숙소 추천 3가지를 JSON 배열로 응답하세요.
        형식: [{"name": "숙소명", "reason": "추천 이유", "category": "카테고리"}]`;

      const command = new InvokeModelCommand({
        modelId:     'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept:      'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const response = await client.send(command);
      const output   = JSON.parse(Buffer.from(response.body).toString());
      const text     = output.content?.[0]?.text ?? '[]';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      res.json({ success: true, data: recommendations, source: 'bedrock' });
      return;
    } catch (err) {
      logger.error('Bedrock recommendation failed, falling back', { err });
    }
  }

  // 로컬 또는 Bedrock 실패 시 → 인기 숙소 기반 추천
  res.json({
    success: true,
    data: [
      { name: '제주 바다뷰 리조트', reason: '최고 평점의 제주 숙소', category: 'resort' },
      { name: '부산 해운대 호텔', reason: '해운대 해변 근처 인기 숙소', category: 'hotel' },
      { name: '서울 도심 게스트하우스', reason: '관광지 접근성 우수', category: 'guesthouse' },
    ],
    source: 'fallback',
  });
}
