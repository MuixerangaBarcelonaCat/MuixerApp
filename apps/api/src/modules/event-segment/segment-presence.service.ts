import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PRESENCE_EDITING_WINDOW_MS, SegmentEditor } from '@muixer/shared';
import { User } from '../user/user.entity';

const UNKNOWN_EDITOR_ALIAS = 'Un altre tècnic';

/**
 * Who is editing which segment right now: only fed by `markEditing` (a revision poll sent with
 * `editing=1` after a mutation), so merely having a segment open leaves no trace.
 */
// ponytail: per-process Map; with N API processes each sees only its own clients.
@Injectable()
export class SegmentPresenceService {
  /** segmentId → userId → entry */
  private readonly segments = new Map<string, Map<string, { alias: string; lastEditAt: number }>>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async markEditing(segmentId: string, userId: string): Promise<void> {
    let editors = this.segments.get(segmentId);
    const existing = editors?.get(userId);
    if (existing) {
      existing.lastEditAt = Date.now();
      return;
    }
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['person'] });
    const alias = user?.person?.alias || UNKNOWN_EDITOR_ALIAS;
    editors = this.segments.get(segmentId) ?? new Map();
    editors.set(userId, { alias, lastEditAt: Date.now() });
    this.segments.set(segmentId, editors);
  }

  editorsIn(segmentId: string, exceptUserId: string): SegmentEditor[] {
    const editors = this.segments.get(segmentId);
    if (!editors) return [];
    const now = Date.now();
    const result: SegmentEditor[] = [];
    for (const [userId, entry] of editors) {
      if (now - entry.lastEditAt >= PRESENCE_EDITING_WINDOW_MS) editors.delete(userId);
      else if (userId !== exceptUserId) result.push({ userId, alias: entry.alias });
    }
    if (editors.size === 0) this.segments.delete(segmentId);
    return result;
  }
}
