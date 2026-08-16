import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { News } from './news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private readonly newsRepository: Repository<News>,
  ) {}

  findAll(): Promise<News[]> {
    return this.newsRepository.find({ order: { publishedAt: 'DESC' } });
  }

  async findOne(id: string): Promise<News> {
    const news = await this.newsRepository.findOne({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }
    return news;
  }

  create(dto: CreateNewsDto): Promise<News> {
    const news = this.newsRepository.create({
      ...dto,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
    });
    return this.newsRepository.save(news);
  }

  async update(id: string, dto: UpdateNewsDto): Promise<News> {
    await this.findOne(id);

    const { publishedAt, ...rest } = dto;
    const merged = this.newsRepository.create({
      id,
      ...rest,
      ...(publishedAt !== undefined
        ? { publishedAt: publishedAt ? new Date(publishedAt) : null }
        : {}),
    });
    await this.newsRepository.save(merged);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.newsRepository.delete(id);
  }

  /** Published = `publishedAt` set and not in the future. `NULL <= now` is falsy in SQL, so drafts drop out naturally. */
  findPublished(): Promise<News[]> {
    return this.newsRepository.find({
      where: { publishedAt: LessThanOrEqual(new Date()) },
      order: { publishedAt: 'DESC' },
    });
  }

  async findPublishedOne(id: string): Promise<News> {
    const news = await this.findOne(id);
    if (!news.publishedAt || news.publishedAt > new Date()) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }
    return news;
  }
}
