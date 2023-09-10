import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { addFriendValidator } from "@/lib/validations/add-friend";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email: emailToAdd } = addFriendValidator.parse(body.email)

        const idToAdd = await fetchRedis('get', `user:email:${emailToAdd}`) as string

        if (!idToAdd) {
            return NextResponse.json({ error: 'This person does not exist.' }, { status: 400 })
        }

        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (idToAdd === session.user.id) {
            return NextResponse.json({ error: 'You cannot add yourself as a friend' }, { status: 400 })
        }

        // check if user is already added
        const isAlreadyAdded = await fetchRedis('sismember', `user:${idToAdd}:incoming_friend_requests`, session.user.id) as 0 | 1
        if (isAlreadyAdded) {
            return NextResponse.json({ error: 'Already added this user' }, { status: 400 })
        }
        // check if user is already friend
        const isAlreadyFriends = await fetchRedis('sismember', `user:${session.user.id}:friends`, idToAdd) as 0 | 1
        if (isAlreadyFriends) {
            return NextResponse.json({ error: 'Already friends with this user' }, { status: 400 })
        }

        // valid request, send friend request
        db.sadd(`user:${idToAdd}:incoming_friend_requests`, session.user.id)

        return NextResponse.json({ response: 'OK' })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request payload' }, { status: 422 })
        }
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}